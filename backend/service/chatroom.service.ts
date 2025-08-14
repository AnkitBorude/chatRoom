import WebSocket from "ws";
import { Client} from "backend/types";
import { ConnectionMessage } from "@shared/message.type";
import {RequestType} from "@shared/request.enum";
import { ChatRoomUtility } from "backend/util/chatroom.util";
import { RedisHelper } from "backend/redis/redis.helper";
import { RedisClientType } from "redis";


export class RoomManager {

  //map to hold clientId to websocket at locallevel
  private clientsToWs:Map<number,WebSocket>;
  private  rooms:Map<number,Set<number>>;
  private roomUtility:ChatRoomUtility;
  private redis:RedisHelper;
  private redisSubsriber:RedisClientType;
   constructor(client:RedisClientType,subscriber:RedisClientType){
    this.clientsToWs=new Map();
    this.rooms=new Map();
    this.roomUtility=new ChatRoomUtility();
    this.redis=new RedisHelper(client);
    this.redisSubsriber=subscriber;
   }

   
  async createClient(ws: WebSocket){
    const tmp_id=this.roomUtility.generateNewClientId();
    const client:Client={
      id:tmp_id,
      name:"User "+tmp_id,
      createdAt:new Date()
    }
    try{
    await this.redis.createNewClient(client);
    }catch(error)
    {
      
      console.error(error);
    }
    this.clientsToWs.set(tmp_id,ws);
    const responseString=this.roomUtility.generateMessageString<ConnectionMessage>(
      {
    id: client.id,
    type: RequestType.CONNECT,
    username: client.name,
    message: "Welcome to server",
    }
    );
    // client.ws.on("close", () => {
    //   this.removeClient(ws);
    // });

    ws.send(responseString);
  }

  // createRoom(ws: WebSocket, name: string) {
  //   //create Room and ad creator client in that room
  //   const client = this.getClientBySocket(ws);
  //   if(!this.isClientExists(ws,client)){return;}
  //   this.roomIdCounter++;
  //   const room: Room = {
  //     id: this.roomIdCounter,
  //     clients: [],
  //     name: name,
  //   };
  //   this.chatRooms.set(this.roomIdCounter, room);
  //   const response = this.messageFactory(
  //     RequstType.CREATE,
  //     `Room Created Successfully RoomID: ${room.id} RoomName: ${room.name}`,
  //   )(name, room.id);
  //   ws.send(JSON.stringify(response));
  //   this.joinRoom(ws,room.id);
  // }

  // renameUser(ws: WebSocket, newUsername: string) {
  //   const client = this.getClientBySocket(ws);
  //   if(!this.isClientExists(ws,client)){return;}
  //   if(!client){return;}

  //   const previousname = client.name;
  //   client.name = newUsername;

  //   const response = this.messageFactory(
  //     RequstType.RENAME,
  //     `Username changed successfully from ${previousname} to ${newUsername} `,
  //   )(newUsername);

  //   ws.send(JSON.stringify(response));

  //   const clientRoom=this.isPartofAroom(ws,client,false);

  //   if(clientRoom){
  //     const roomNotification=this.createClientNotificationofMessage(
  //       `User ${client.id} Changed his username from ${previousname} to ${newUsername}`,
  //       RequstType.RENAME
  //     );
  //     this.broadcastNotification(clientRoom,client,roomNotification)
  //   }
  // }

  // joinRoom(ws: WebSocket, roomId: number) {
  //   const client = this.getClientBySocket(ws);
  //   if(!this.isClientExists(ws,client)){return;}
  //   if(!client){return;}

  //   //check whether the passed roomId exists
  //   const roomToJoin = this.chatRooms.get(roomId);
  //   if (!roomToJoin) {
  //       const response = this.messageFactory(
  //         RequstType.JOIN,
  //         "Room NOT Found 404",
  //       )(roomId, client.name,0,'Not 404 Found');
  //       ws.send(JSON.stringify(response));
  //       return;
  //     }
    
  //     const clientsRoom=this.isPartofAroom(ws,client,false);
  //     if(clientsRoom){
  //       this.leaveRoom(ws);
  //     }
     
  //       client.roomId = roomToJoin.id;
  //       roomToJoin.clients.push(client);
  //       const JoinMessageToUser=this.messageFactory(RequstType.JOIN,`Joined room ${roomToJoin.name} current Online ${roomToJoin?.clients.length}`)
  //       (roomToJoin.id,roomToJoin.name,roomToJoin.clients.length,roomToJoin.name);

  //     const JoinNotificationToOthers=this.createClientNotificationofMessage(`${client.name} has Joined the Room`,
  //       RequstType.JOIN
  //     )
  //     client.ws.send(JSON.stringify(JoinMessageToUser));
  //     this.broadcastNotification(roomToJoin,client,JoinNotificationToOthers);    
  // }

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

  // private getClientBySocket(ws: WebSocket): Client | undefined {
  //   const clientId = this.wsToClientId.get(ws);
  //   return clientId !== undefined ? this.clients.get(clientId) : undefined;
  // }

  // private isClientExists(ws:WebSocket,client:Client | undefined)
  // {
  //  if (!client) {
  //     const response = this.messageFactory(
  //       RequstType.LEAVE,
  //       "Client not found 404",
  //     )(404);
  //     ws.send(JSON.stringify(response));
  //     return false;
  //   }
  //   return true;
  // }

  // private isPartofAroom(ws:WebSocket,client:Client,notifyClient:boolean=true)
  // {
  //   if(client.roomId)
  //   {
  //     //check if that room exists or not
  //     const room=this.chatRooms.get(client.roomId);
  //     if(room)
  //     {
  //       //roomExists
  //       //verify if the client is present in that room or not
  //       if(room?.clients.includes(client)){
  //         //client exists in room too
  //         return room;
  //       }
  //     }
  //     client.roomId=undefined;
  //   }
  //   if(notifyClient)
  //   {
  //   const notification=this.createClientNotificationofMessage(` User id: ${client.id} ${client.name} Not a part of any room yet`,RequstType.NOTIFY);
  //   ws.send(notification);
  //   }
    
  //   return undefined;
  // }

  // private createClientNotificationofMessage(message:string,type:RequstType,additional?:Record<string,string>){
  //    const notification:RoomNotificationMessage={
  //       message:message.trim(),
  //       notificationOf:type,
  //       type:RequstType.NOTIFY,
  //       additional
  //     }
  //     return JSON.stringify(notification);
  // }

  // private broadcastNotification(room:Room,sender:Client,notification:string)
  // {
  //   room.clients.forEach((otherClient) => {
  //       if(otherClient!=sender){
  //       otherClient.ws.send(notification);
  //       }
  //     });
  // }
}
