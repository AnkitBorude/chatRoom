import WebSocket from "ws";
import { Client, Room } from "backend/types";
import {
  ChatMessage,
  ConnectionMessage,
  CreateMessage,
  JoinMessage,
  LeaveMessage,
  RenameMessage,
  RoomNotificationMessage,
} from "@shared/message.type";
import { RequestType } from "@shared/request.enum";
import { ChatRoomUtility } from "backend/util/chatroom.util";
import { RedisHelper } from "backend/redis/redis.helper";

export class RoomManager {
  //map to hold clientId to websocket at locallevel
  private clientsToWs: Map<number, WebSocket>;
  private wsToClientId: Map<WebSocket, number>;
  private rooms: Map<number, Set<number>>;
  private roomUtility: ChatRoomUtility;
  private redis: RedisHelper;

  constructor(redis: RedisHelper) {
    this.clientsToWs = new Map();
    this.wsToClientId = new Map();

    this.rooms = new Map();
    this.roomUtility = new ChatRoomUtility();
    this.redis = redis;
  }

  async createClient(ws: WebSocket) {
    const tmp_id = this.roomUtility.generateNewClientId();
    const client: Client = {
      id: tmp_id,
      name: "User " + tmp_id,
      createdAt: new Date(),
    };
    try {
      await this.redis.createNewClient(client);
    } catch (error) {
      console.error(error);
    }
    this.clientsToWs.set(tmp_id, ws);
    this.wsToClientId.set(ws, tmp_id);

    const responseString =
      this.roomUtility.generateMessageString<ConnectionMessage>({
        id: client.id,
        type: RequestType.CONNECT,
        username: client.name,
        message: "Welcome to server",
      });
    // attach event handler here to listen for
    // close event
    ws.on("close", () => {
      this.removeClient(ws);
    });

    ws.send(responseString);
  }

  public async createRoom(ws: WebSocket, message: CreateMessage) {
    //create Room and ad creator client in that room
    const client = await this.getClientBySocket(ws);
    if (!client) {
      //send the error code back to ws
      console.log("Client does not exists thus cannot create room");
      return;
    }

    const room: Room = {
      id: this.roomUtility.generateNewRoomId(),
      name: message.roomName,
      createdAt: new Date(),
      createdBy: client.id,
      activeUsers: 0,
    };

    //creating new room and adding owner to newly created room
    await this.redis.createNewRoom(room);

    // if(!this.isClientExists(ws,client)){return;}
    const responseString =
      this.roomUtility.generateMessageString<CreateMessage>({
        roomId: room.id,
        message: `Room Created Successfully RoomID: ${room.id} RoomName: ${room.name}`,
        type: RequestType.CREATE,
        roomName: room.name,
      });
    ws.send(responseString);

    this.joinRoom(ws, room.id);
  }

  public async renameUser(ws: WebSocket, message: RenameMessage) {
    const client = await this.getClientBySocket(ws);

    if (!client) {
      //send the error code back to ws
      console.log("Client does not exists thus cannot rename user");
      return;
    }
    const previousname = client.name;
    await this.redis.updateClient(client.id, { name: message.username });

    const clientResponse =
      this.roomUtility.generateMessageString<RenameMessage>({
        message: `Username changed successfully from ${previousname} to ${message.username} `,
        type: RequestType.RENAME,
        username: message.username,
      });

    ws.send(JSON.stringify(clientResponse));

    const roomIdofClient = await this.isPartofAlocalRoom(client);

    if (roomIdofClient) {
      const roomNotification =
        this.roomUtility.createClientNotificationofMessage(
          `User ${client.id} Changed his username from ${previousname} to ${message.username}`,
          RequestType.RENAME,
        );
      this.broadcastLocalRoomNotification(
        roomIdofClient,
        client.id,
        roomNotification,
      );
      this.broadcastNotificationOnGlobal(roomIdofClient, roomNotification);
    }
  }

  public async joinRoom(ws: WebSocket, message: JoinMessage): Promise<void>;
  public async joinRoom(ws: WebSocket, roomId: number): Promise<void>;

  public async joinRoom(ws: WebSocket, secondArg: JoinMessage | number) {
    let roomIdToJoin;

    if (typeof secondArg === "number") {
      roomIdToJoin = secondArg;
    } else {
      roomIdToJoin = secondArg.roomId;
    }
    const client = await this.getClientBySocket(ws);

    if (!client) {
      //send the error code back to ws
      console.log("Client does not exists thus cannot create room");
      return;
    }

    //check whether the passed roomId exists
    const roomToJoin = await this.isRoomExists(roomIdToJoin);

    if (!roomToJoin) {
      const response = this.roomUtility.generateMessageString<JoinMessage>({
        roomId: roomIdToJoin,
        username: client.name,
        activeUsers: 0,
        type: RequestType.JOIN,
        message: "Room NOT Found 404",
        roomName: "NOT FOUND ZERO ROOM",
      });
      ws.send(JSON.stringify(response));
      return;
    }

    const roomId = await this.isPartofAlocalRoom(client);
    if (roomId) {
      //is part of any room leave previous room
      await this.leaveRoom(ws);
    }

    //

    //Now check the room is locally present or not
    if (this.rooms.get(roomIdToJoin)) {
      //this means room is already subscribed and no need of new subscription
      this.rooms.get(roomIdToJoin)?.add(client.id);
    } else {
      this.rooms.set(roomIdToJoin, new Set([client.id]));
      //attach publishMent to room
      //assumming no message burst in that case we would require a queue
      this.redis.subscribeToChatRoomPipeline(roomIdToJoin, (message) => {
        this.broadcastMessage(roomIdToJoin, message);
      });
    }
    await this.redis.addClientInRoom(roomIdToJoin, client.id);

    const joinMessageToUser =
      this.roomUtility.generateMessageString<JoinMessage>({
        activeUsers: roomToJoin.activeUsers,
        message: `Joined room ${roomToJoin.name} current Online ${roomToJoin.activeUsers},created by ${roomToJoin.createdBy} at ${roomToJoin.createdAt.toLocaleString()}`,
        roomId: roomIdToJoin,
        roomName: roomToJoin.name,
        type: RequestType.JOIN,
        username: client.name,
      });

    const joinNotificationToOthers =
      this.roomUtility.createClientNotificationofMessage(
        `${client.name} has Joined the Room`,
        RequestType.JOIN,
      );
    ws.send(JSON.stringify(joinMessageToUser));

    this.broadcastLocalRoomNotification(
      roomIdToJoin,
      client.id,
      joinNotificationToOthers,
    );
    this.broadcastNotificationOnGlobal(roomIdToJoin, joinNotificationToOthers);
  }

  public async leaveRoom(ws: WebSocket) {
    const client = await this.getClientBySocket(ws);
    let deletedLocalRoom: boolean = false;
    let deletedGlobalRoom: boolean = false;

    if (!client) {
      //send the error code back to ws
      console.log("Client does not exists thus cannot leave Room");
      return;
    }

    const currentRoomId = await this.isPartofAlocalRoom(client);

    if (!currentRoomId) {
      //not part of any room so cannot leave invalid command
      return;
    }
    const roomMeta = await this.isRoomExists(currentRoomId);

    //remove from the local set and
    this.rooms.get(currentRoomId)?.delete(client.id);
    const globalRoomSpaceSize = (
      await this.redis.removeClientFromRoom(currentRoomId, client.id)
    ).slice(2);

    //check if the size of local and global room
    //if empty directly delete the room and unsubcribe from the pipeline

    const sizeOfRoom = this.rooms.get(currentRoomId)?.size;

    if (!sizeOfRoom || sizeOfRoom <= 0) {
      //no one in local room
      await this.redis.unSubscribeToChatRoomPipeline(currentRoomId);
      this.rooms.delete(currentRoomId);
      deletedLocalRoom = true;
      //brodcast globally
    }

    //the cardinality of set of users in the room is ultimate source of truth
    if (Number(globalRoomSpaceSize[1]) <= 0) {
      //remove that room and delete the set
      await this.redis.removeEmptyRoom(currentRoomId);
      deletedGlobalRoom = true;
    }

    let leaveNotificationToOthers;
    if (Number(roomMeta?.createdBy) === client.id) {
      leaveNotificationToOthers =
        this.roomUtility.createClientNotificationofMessage(
          `Owner of the room ${client.name} has left the Room`,
          RequestType.LEAVE,
        );
    } else {
      leaveNotificationToOthers =
        this.roomUtility.createClientNotificationofMessage(
          `${client.name} has left the Room`,
          RequestType.LEAVE,
        );
    }

    if (deletedLocalRoom && !deletedGlobalRoom) {
      //send gloabl left message
      this.broadcastNotificationOnGlobal(
        currentRoomId,
        leaveNotificationToOthers,
      );
    } else if (!deletedGlobalRoom && !deletedLocalRoom) {
      this.broadcastNotificationOnGlobal(
        currentRoomId,
        leaveNotificationToOthers,
      );
      this.broadcastLocalRoomNotification(
        currentRoomId,
        client.id,
        leaveNotificationToOthers,
      );
    }

    const leftNotificationToUser =
      this.roomUtility.generateMessageString<LeaveMessage>({
        message: `Left the room ${roomMeta?.name} current active users ${roomMeta?.activeUsers}`,
        roomId: currentRoomId,
        type: RequestType.LEAVE,
      });

    ws.send(JSON.stringify(leftNotificationToUser));
  }

  public async sendMessage(ws: WebSocket, messageObj: ChatMessage) {
    const client = await this.getClientBySocket(ws);
    if (!client) {
      //send the error code back to ws
      console.log("Client does not exists thus cannot create room");
      return;
    }
    const messageId = messageObj.id ?? "0";

    const currentRoomId = await this.isPartofAlocalRoom(client);
    if (!currentRoomId) {
      //not part of any room cannot send message ignore
      return;
    }
    const room = await this.isRoomExists(currentRoomId);

    if (!room) {
      //the room does not exists so cannot send message ignore
      return;
    }

    if (room.activeUsers <= 0) {
      //room is empty
      const notification = this.roomUtility.createClientNotificationofMessage(
        "Room is empty please let other to join to send message",
        RequestType.MESSAGE,
      );
      ws.send(JSON.stringify(notification));
      return;
    }

    const messageTobeSent: ChatMessage = {
      message: messageObj.message,
      roomId: currentRoomId,
      sender: client.name,
      type: RequestType.MESSAGE,
    };

    //although we are broadcasting to global channel thus message might receieved by twice
    //optimization required later
    await this.broadcastLocalRoomNotification(
      currentRoomId,
      client.id,
      messageTobeSent,
    );
    await this.broadcastNotificationOnGlobal(currentRoomId, messageTobeSent);

    const successNotificationToClient =
      this.roomUtility.createClientNotificationofMessage(
        "Message Sent Successfully",
        RequestType.MESSAGE,
        { messageId },
      );
    ws.send(JSON.stringify(successNotificationToClient));
  }

  public async removeClient(ws: WebSocket) {
    //delete client from the all clients map
    //remove the client from the chatrooms
    //if the chatroom has zero clients then delete that room too
    //as we do not allow empty rooms by the way
    const client = await this.getClientBySocket(ws);

    if (client) {
      const roomId = await this.isPartofAlocalRoom(client);
      if (roomId) {
        await this.leaveRoom(ws);
      }
      await this.redis.removeClient(client.id);
      this.wsToClientId.delete(ws);
      this.clientsToWs.delete(client.id);
    }
    console.log("Client Disconnected");
  }

  private async getClientBySocket(ws: WebSocket): Promise<Client | undefined> {
    //returns undefined if the client not found locally or globally
    //check locally
    const clientId = this.wsToClientId.get(ws);
    if (clientId) {
      //check globally
      //the case may arise that the client is present locally but not globally(rare)
      //but the global settings is the source of truth
      //that means lets suppose we removed a client using api endpoint (for like ban or something
      //the user cant access anything)
      return await this.redis.getClientById(clientId);
    }
    //leaky client with no gloabal reference
    //induce sideEffect if possible to remove
    return undefined;
  }

  private async isRoomExists(roomId: number): Promise<Room | undefined> {
    const isLocalRoom = this.rooms.has(roomId);
    if (isLocalRoom) {
      //same case may arise that room is available locally but not globally
      //gloabl settings is source truth
      return await this.redis.getRoomById(roomId);
    }
    //leaky local room with no global reference
    //induce sideEffect if possible to remove leaky room
    return undefined;
  }

  //check whether the client is part of any room if yes then return id of room or
  private async isPartofAlocalRoom(client: Client) {
    if (client.roomId) {
      //check if that room exists or not
      const room = this.rooms.get(client.roomId);
      if (room) {
        //roomExists
        //verify if the client is present in that room or not
        if (room?.has(client.roomId)) {
          //client exists in room too
          return client.roomId;
        }
      }
      //deleting leaky roomId on the client
      delete client.roomId;
    }
    return undefined;
  }

  private async broadcastLocalRoomNotification(
    roomId: number,
    senderId: number,
    notification: RoomNotificationMessage | ChatMessage,
  ) {
    const message = JSON.stringify(notification);
    this.rooms.get(roomId)?.forEach((otherClientId) => {
      if (otherClientId != senderId) {
        this.clientsToWs.get(otherClientId)?.send(message);
      }
    });
  }

  private async broadcastNotificationOnGlobal(
    roomId: number,
    notification: RoomNotificationMessage | ChatMessage,
  ) {
    const message = JSON.stringify(notification);
    try {
      await this.redis.publishMessage(roomId, message);
    } catch (error) {
      console.log(
        "Message cannot be brodcasted to other server redis error" + error,
      );
    }
  }

  private broadcastMessage(roomId: number, message: string) {
    this.rooms.get(roomId)?.forEach((otherClientId) => {
      this.clientsToWs.get(otherClientId)?.send(message);
    });
  }
}
