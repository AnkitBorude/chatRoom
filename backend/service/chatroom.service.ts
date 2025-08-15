import WebSocket from "ws";
import { Client, Room } from "backend/types";
import {
  ConnectionMessage,
  CreateMessage,
  JoinMessage,
  RenameMessage,
  RoomNotificationMessage,
} from "@shared/message.type";
import { RequestType } from "@shared/request.enum";
import { ChatRoomUtility } from "backend/util/chatroom.util";
import { RedisHelper } from "backend/redis/redis.helper";
import { RedisClientType } from "redis";

export class RoomManager {
  //map to hold clientId to websocket at locallevel
  private clientsToWs: Map<number, WebSocket>;
  private wsToClientId: Map<WebSocket, number>;
  private rooms: Map<number, Set<number>>;
  private roomUtility: ChatRoomUtility;
  private redis: RedisHelper;

  constructor(client: RedisClientType, subscriber: RedisClientType) {
    this.clientsToWs = new Map();
    this.wsToClientId = new Map();

    this.rooms = new Map();
    this.roomUtility = new ChatRoomUtility();
    this.redis = new RedisHelper(client, subscriber);
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
    //attach event handler here to listen for
    //close event
    // client.ws.on("close", () => {
    //   this.removeClient(ws);
    // });

    ws.send(responseString);
  }

  async createRoom(ws: WebSocket, message: CreateMessage) {
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

    //Check whether client is part of any room yet
    // const clientId=this.isPartofAlocalRoom(client);
    // if(clientId){
    //   this.leaveRoom(ws);
    // }

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
    this.clientsToWs.get(client.id)?.send(JSON.stringify(joinMessageToUser));

    this.broadcastLocalRoomNotification(
      roomIdToJoin,
      client.id,
      joinNotificationToOthers,
    );
    this.broadcastNotificationOnGlobal(roomIdToJoin, joinNotificationToOthers);
  }

  // leaveRoom(ws: WebSocket) {
  //   const client = this.getClientBySocket(ws);
  //   if(!this.isClientExists(ws,client)){return;}
  //   if(!client){return;};
  //   const currentRoom=this.isPartofAroom(ws,client);
  //   if(!currentRoom){return;}

  //     currentRoom.clients = currentRoom.clients.filter(
  //       (c) => c.id !== client.id,
  //     );

  //     if (currentRoom.clients.length == 0) {
  //       //if room is empty
  //       this.chatRooms.delete(currentRoom.id);
  //       client.roomId=undefined;
  //     } else {
  //       const leaveNotificationToOthers=this.createClientNotificationofMessage(`${client.name} has left the Room`,RequstType.LEAVE);
  //       this.broadcastNotification(currentRoom,client,leaveNotificationToOthers);
  //     }

  //   const leftNotificationToUser: LeaveMessage = this.messageFactory(
  //     RequstType.LEAVE,
  //     `Left the room ${currentRoom?.name}`,
  //   )(currentRoom.id);

  //   client.roomId = undefined;

  //   client.ws.send(JSON.stringify(leftNotificationToUser));
  // }

  // sendMessage(ws:WebSocket,messageObject:ChatMessage)
  // {
  //   const client=this.getClientBySocket(ws);
  //   const message=messageObject.message;
  //   const messageId=messageObject.id ?? "0";
  //   if(!this.isClientExists(ws,client)){return;}
  //   //just to off this f*cking eslint error of undefined client
  //   if(!client){return};
  //   const room=this.isPartofAroom(ws,client)
  //   if(!room){return;}
  //   if(room.clients.length==0)
  //   {
  //     //room is empty
  //     const notification=this.createClientNotificationofMessage('Room is empty please let other to join to send message',RequstType.MESSAGE);
  //     ws.send(notification);
  //     return;
  //   }

  //   const messageTobeSent=this.messageFactory(RequstType.MESSAGE,message.trim())(room.id,client.name);
  //   room.clients.forEach((otherClient)=>{
  //     if(client!=otherClient)
  //     {
  //      otherClient.ws.send(JSON.stringify(messageTobeSent));
  //     }
  //   })

  //   const successNotificationToClient=this.createClientNotificationofMessage("Message Sent Successfully",RequstType.MESSAGE,{messageId});
  //   ws.send(successNotificationToClient);
  // }
  // // Overloade signatures
  // private messageFactory(
  //   request: RequstType.CREATE,
  //   message: string,
  // ): (roomName: string, roomId: number) => CreateMessage;
  // private messageFactory(
  //   request: RequstType.JOIN,
  //   message: string,
  // ): (roomId: number, username: string,activeUsers:number,roomName:string) => JoinMessage;
  // private messageFactory(
  //   request: RequstType.MESSAGE,
  //   message: string,
  // ): (roomId: number,sender:string) => ChatMessage;
  // private messageFactory(
  //   request: RequstType.RENAME,
  //   message: string,
  // ): (username: string) => RenameMessage;

  // private messageFactory(
  //   request: RequstType.LEAVE,
  //   message: string,
  // ): (roomId: number) => LeaveMessage;

  // // Implementation
  // private messageFactory(request: RequstType, message: string) {
  //   switch (request) {
  //     case RequstType.CREATE:
  //       return (roomName: string, roomId: number): CreateMessage => ({
  //         type: request,
  //         roomName,
  //         roomId,
  //         message,
  //       });
  //     case RequstType.JOIN:
  //       return (roomId: number, username: string,activeUsers:number,roomName:string): JoinMessage => ({
  //         type: request,
  //         roomId,
  //         username,
  //         message,
  //         activeUsers,
  //         roomName
  //       });
  //     case RequstType.MESSAGE:
  //       return (roomId: number,sender:string): ChatMessage => ({
  //         type: request,
  //         roomId,
  //         message,
  //         sender
  //       });
  //     case RequstType.RENAME:
  //       return (username: string): RenameMessage => ({
  //         type: request,
  //         username,
  //         message,
  //       });
  //     case RequstType.LEAVE:
  //       return (roomId: number): LeaveMessage => ({
  //         type: request,
  //         roomId,
  //         message,
  //       });
  //     default:
  //       throw new Error("Invalid request type");
  //   }
  // }

  // private removeClient(ws: WebSocket) {
  //   //delete client from the all clients map
  //   //remove the client from the chatrooms
  //   //if the chatroom has zero clients then delete that room too
  //   //as we do not allow empty rooms by the way
  //   this.leaveRoom(ws);
  //   const client = this.getClientBySocket(ws);
  //   if (client) {
  //     this.clients.delete(client.id);
  //   }
  //   this.wsToClientId.delete(ws);
  //   console.log("Client Disconnected");
  // }

  private async getClientBySocket(ws: WebSocket): Promise<Client | undefined> {
    //returns undefined if the client not found locally or globally
    //check locally
    const clientId = this.wsToClientId.get(ws);
    if (clientId) {
      //check globally
      //the case may arise that the client is present locally but not globally(rare)
      //but the global settings is the source of truth
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
    notification: RoomNotificationMessage,
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
    notification: RoomNotificationMessage,
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
