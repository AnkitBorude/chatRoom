import WebSocket from "ws";
import { Client, Room, ServerStatsInfo } from "backend/types";
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
  private serverId: string;
  private iMessageCounter;
  private sMessageCounter;
  private totalRoomsCreated: number;
  private _logger;
  constructor(redis: RedisHelper, serverId: string) {
    this.clientsToWs = new Map();
    this.wsToClientId = new Map();

    this.rooms = new Map();
    this.roomUtility = new ChatRoomUtility();
    this._logger=this.roomUtility.getLogger();
    this.redis = redis;
    this.serverId = serverId;
    this.iMessageCounter = this.sMessageCounter = 0;
    this.totalRoomsCreated = 0;
  }

  public getStatistics(): ServerStatsInfo {
    const totalCon = Math.max(this.clientsToWs.size, this.wsToClientId.size);
    return {
      activeConnections: totalCon,
      totalRooms: this.rooms.size,
      totalMessagesReceived: this.iMessageCounter,
      totalMessagesSent: this.sMessageCounter,
      leakyConnections:
        totalCon - Math.min(this.clientsToWs.size, this.wsToClientId.size),
      totalRoomsCreated: this.totalRoomsCreated,
      lastUpdatedAt: Date.now(),
    };
  }
  async createClient(ws: WebSocket,ip:string) {
    const tmp_id = this.roomUtility.generateNewClientId();
    this.clientsToWs.set(tmp_id, ws);
    this.wsToClientId.set(ws, tmp_id);
    const client: Client = {
      id: tmp_id,
      name: "User " + tmp_id,
      createdAt: new Date(),
    };
    try {
      await this.redis.createNewClient(client);
    } catch (error) {
      this._logger.error("Error whiles storing new client metadata in redis "+(error as Error).message,client.id,RequestType.CREATE);
    }

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
    this._logger.info("Client Id generated for socket connection from  ip "+ip,client.id,RequestType.CREATE);
  }

  public async createRoom(ws: WebSocket, message: CreateMessage) {
    //create Room and ad creator client in that room
    const client = await this.getClientBySocket(ws);
    if (!client) {
      ws.send(this.roomUtility.createNotFoundMessage());
      this._logger.warn("Unknown Client",0,RequestType.CREATE);
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
        message: ` Room Created Successfully RoomID: ${room.id} RoomName: ${room.name} `,
        type: RequestType.CREATE,
        roomName: room.name,
      });
    ws.send(responseString);

    this._logger.info("Room Created Successfully Room Data "+JSON.stringify(room),client.id,RequestType.CREATE);
    await this.joinRoom(ws, room.id);

    this.totalRoomsCreated++;
  }

  public async renameUser(ws: WebSocket, message: RenameMessage) {
    const client = await this.getClientBySocket(ws);

    if (!client) {
      ws.send(this.roomUtility.createNotFoundMessage());
      this._logger.warn("Unknown Client",0,RequestType.RENAME);
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

    ws.send(clientResponse);

    this._logger.info(`username updated from ${previousname} to ${message.username}`,client.id,RequestType.RENAME);
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
    let roomIdToJoin: number;
    if (typeof secondArg === "number") {
      roomIdToJoin = secondArg;
    } else {
      roomIdToJoin = Number(secondArg.roomId);
    }
    const client = await this.getClientBySocket(ws);

    if (!client) {
      //send the error code back to ws
      ws.send(this.roomUtility.createNotFoundMessage());
      this._logger.warn("Unknown Client",0,RequestType.JOIN);
      return;
    }
    //check whether the passed roomId exists
    const roomToJoin = await this.isRoomExistsGlobally(roomIdToJoin);

    if (!roomToJoin) {
      const response = this.roomUtility.generateMessageString<JoinMessage>({
        roomId: 404,
        username: client.name,
        activeUsers: 0,
        type: RequestType.JOIN,
        message: roomIdToJoin + " Room NOT Found please enter valid room id",
        roomName: "NOT FOUND ZERO ROOM",
      });
      ws.send(response);
      this._logger.warn("Requested room not found room id "+roomIdToJoin,client.id,RequestType.JOIN);
      return;
    }

    const roomId = await this.isPartofAlocalRoom(client);
    if (roomId) {
      this._logger.info("Client is part of a existing room,leaving previous room "+roomId,client.id,RequestType.JOIN);
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
        const incomingMessage =
          this.roomUtility.retrieveUUIDandMessage(message);
        if (incomingMessage[0] !== this.serverId) {
          this._logger.native.info("Message Recieved from global pipeline for room id "+roomIdToJoin)
          this.broadcastMessage(roomIdToJoin, incomingMessage[1]);
        }
      });
    }
    await this.redis.addClientInRoom(roomIdToJoin, client.id);

    const joinMessageToUser =
      this.roomUtility.generateMessageString<JoinMessage>({
        activeUsers: roomToJoin.activeUsers,
        message: `Joined room Name: ${roomToJoin.name} total active: ${roomToJoin.activeUsers},owner ID: ${roomToJoin.createdBy} `,
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
    ws.send(joinMessageToUser);

    this._logger.info("Client successfully joined room id "+roomIdToJoin,client.id,RequestType.JOIN);
    this.broadcastLocalRoomNotification(
      roomIdToJoin,
      client.id,
      joinNotificationToOthers,
    );
    this.broadcastNotificationOnGlobal(roomIdToJoin, joinNotificationToOthers);
  }

  public async leaveRoom(ws: WebSocket, clientArg?: Client) {
    let client: Client;
    let currentRoomId: number | undefined;
    let deletedLocalRoom: boolean = false;
    let deletedGlobalRoom: boolean = false;

    if (clientArg) {
      client = clientArg;
      currentRoomId = client.roomId;
    } else {
      const rClient = await this.getClientBySocket(ws);
      if (!rClient) {
        ws.send(this.roomUtility.createNotFoundMessage());
        this._logger.warn("Unknown Client",0,RequestType.LEAVE);
        return;
      }
      client = rClient;
      currentRoomId = await this.isPartofAlocalRoom(client);
    }

    if (!currentRoomId) {
      //not part of any room so cannot leave invalid command
      this._logger.warn("Client not part of any room thus cannot leave room",client.id,RequestType.LEAVE);
      return;
    }
    const roomMeta = await this.isRoomExists(currentRoomId);
    this.rooms.get(currentRoomId)?.delete(client.id);
    const globalRoomSpaceSize = (
      await this.redis.removeClientFromRoom(currentRoomId, client.id)
    ).slice(2);

    //check if the size of local and global room
    //if empty directly delete the room and unsubcribe from the pipeline

    const sizeOfRoom = this.rooms.get(currentRoomId)?.size;

    if (!sizeOfRoom || sizeOfRoom <= 0) {
      //no one in local room

      this._logger.info("Room "+currentRoomId+" is empty LOCALLY , deleting empty room LOCALLY",client.id,RequestType.LEAVE);
      await this.redis.unSubscribeToChatRoomPipeline(currentRoomId);
      this.rooms.delete(currentRoomId);
      deletedLocalRoom = true;
      //brodcast globally
    }

    //the cardinality of set of users in the room is ultimate source of truth
    if (Number(globalRoomSpaceSize[1]) <= 0) {
      await this.redis.removeEmptyRoom(currentRoomId);
      this._logger.info("Room "+currentRoomId+" is empty GLOBALLY , deleting empty room GLOBALLY",client.id,RequestType.LEAVE);
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

    ws.send(leftNotificationToUser);

    this._logger.info("Successfully Left room data "+JSON.stringify(roomMeta),client.id,RequestType.LEAVE);
  }

  public async sendMessage(ws: WebSocket, messageObj: ChatMessage) {
    const client = await this.getClientBySocket(ws);
    if (!client) {
      ws.send(this.roomUtility.createNotFoundMessage());
      this._logger.warn("Unknown Client",0,RequestType.MESSAGE);
      return;
    }
    const messageId = messageObj.id ?? "0";

    const currentRoomId = await this.isPartofAlocalRoom(client);
    if (!currentRoomId) {
      //not part of any room cannot send message ignore
      this._logger.warn("Client is not part of any room thus cannot send message ",client.id,RequestType.MESSAGE);
      return;
    }
    const room = await this.isRoomExists(currentRoomId);

    if (!room) {
      //the room does not exists so cannot send message ignore
      this._logger.warn("Requested room id "+currentRoomId+" does not exists, cannot send message ",client.id,RequestType.MESSAGE);
      return;
    }

    if (room.activeUsers <= 0) {
      //room is empty//rarest of rarest possibility
      //if any case the room is not garbage collected
      const notification = this.roomUtility.createClientNotificationofMessage(
        "Room is empty please let other to join to send message",
        RequestType.MESSAGE,
      );
      ws.send(JSON.stringify(notification));
        this._logger.warn("Requested room is empty, cannot send message",client.id,RequestType.MESSAGE);
      return;
    }

    const messageTobeSent: ChatMessage = {
      message: messageObj.message,
      roomId: currentRoomId,
      sender: client.name,
      type: RequestType.MESSAGE,
    };

    //although we are broadcasting to global channel thus message might receieved by twice
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
    this._logger.info("Message broadcasted Successfully",client.id,RequestType.MESSAGE);
    this.sMessageCounter++;
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
      this._logger.native.info("Client removed successfully",client.id);
    }
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
      const client = await this.redis.getClientById(clientId);

      //leaky client with no gloabal reference
      //induced sideEffect to remove them
      if (!client) {
        //this means client not available globally.
        //check if it was part of any available room on server
        for (const [key, set] of this.rooms) {
          if (set.has(clientId)) {
            //remove from the room also
            //creating a client clone
            const clientDummy: Client = {
              id: clientId,
              createdAt: new Date(),
              name: "System " + clientId,
              roomId: key,
            };

            await this.leaveRoom(ws, clientDummy);
            break;
          }
        }
        this.wsToClientId.delete(ws);
        this.clientsToWs.delete(clientId);
      }
      return client;
    }

    return undefined;
  }

  private async isRoomExists(roomId: number): Promise<Room | undefined> {
    const isLocalRoom = this.rooms.has(roomId);
    if (isLocalRoom) {
      //same case may arise that room is available locally but not globally
      //gloabl settings is source truth
      const gloablRoom = await this.isRoomExistsGlobally(roomId);
      if (!gloablRoom) {
        await this.removeLocalRoom(roomId);
      }
      return gloablRoom;
    }
    //leaky local room with no global reference
    //induce sideEffect if possible to remove leaky room
    return undefined;
  }
  private async isRoomExistsGlobally(
    roomId: number,
  ): Promise<Room | undefined> {
    return await this.redis.getRoomById(roomId);
  }

  //check whether the client is part of any room if yes then return id of room or
  private async isPartofAlocalRoom(client: Client) {
    if (client.roomId) {
      //check if that room exists or not
      const room = this.rooms.get(client.roomId);
      if (room) {
        //roomExists
        //verify if the client is present in that room or not
        if (room?.has(client.id)) {
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
    this._logger.native.info("A Message broadcasted on local room id "+roomId,{clientId:senderId});
  }

  private async broadcastNotificationOnGlobal(
    roomId: number,
    notification: RoomNotificationMessage | ChatMessage,
  ) {
    let message = JSON.stringify(notification);
    message = this.roomUtility.appendUUIDtoMessage(this.serverId, message);
    try {
      await this.redis.publishMessage(roomId, message);
      this._logger.native.info("A Message published globally on room id "+roomId);
    } catch (error) {
      this._logger.native.error("error during publishing notification on room id "+roomId+"redis error "+(error as Error).message);
    }
  }

  private broadcastMessage(roomId: number, message: string) {
    this.rooms.get(roomId)?.forEach((otherClientId) => {
      this.clientsToWs.get(otherClientId)?.send(message, (error) => {
        if (error) {
          console.log(
            "Error while brodcasting while broadcasting to " +
              otherClientId +
              " error is " +
              error,
          );
        }
      });
    });
    this.sMessageCounter++;
  }

  private async removeLocalRoom(roomId: number) {
    const clientsInroom = this.rooms.get(roomId);

    const leftNotificationToUser =
      this.roomUtility.generateMessageString<LeaveMessage>({
        message: `Your current room has been removed by ther server / system kindly connect again`,
        roomId,
        type: RequestType.LEAVE,
      });
    //remving client from gloabl room and sending message back;
    clientsInroom?.forEach(async (cliendId) => {
      await this.redis.removeClientFromRoom(roomId, cliendId, true);
      this.clientsToWs.get(cliendId)?.send(leftNotificationToUser);
    });
    await this.redis.unSubscribeToChatRoomPipeline(roomId);
    await this.redis.removeEmptyRoom(roomId);

    this.rooms.delete(roomId);

    this._logger.native.warn("Removed local room completely room id"+roomId);
  }
}
