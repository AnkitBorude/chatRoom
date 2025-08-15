import http from "http";
import { RedisClientType } from "redis";
import WebSocket from "ws";
import { RoomManager } from "./service/chatroom.service";
export class ChatRoomWebsocket {
  private websocketServer: WebSocket.Server;
  private roomManager: RoomManager;
  private connectionLifeMap: Map<WebSocket, boolean>;
  private readonly PING_INTERVAL: number = 30000;
  constructor(
    server: http.Server,
    client: RedisClientType,
    subscriber: RedisClientType,
  ) {
    this.websocketServer = new WebSocket.Server({ server });
    this.roomManager = new RoomManager(client, subscriber);
    this.connectionLifeMap = new Map();
  }

  public initialize() {
    this.websocketServer.on("connection", (websocket) => {
      // Client connected to server
      this.roomManager.createClient(websocket);
      this.connectionLifeMap.set(websocket, true);
      websocket.on("pong", () => {
        this.connectionLifeMap.set(websocket, true);
      });
      // websocket.on('message',(incomingMessage)=>this.incomingMessageHandlers(incomingMessage.toString('utf-8'),websocket));
    });

    this.websocketServer.on("error", (error) => {
      console.log("Something went wrong with websocket " + error.message);
    });

    const pingInterval = setInterval(() => {
      this.connectionLifeMap.forEach((isAlive, socket, map) => {
        if (isAlive) {
          socket.ping();
          map.set(socket, false);
        } else {
          //if the connection is dead remove the socket and
          //cleanup the memory(remove client from the room if any)
          socket.terminate();
          map.delete(socket);
        }
      });
    }, this.PING_INTERVAL);

    this.websocketServer.on("close", () => {
      clearInterval(pingInterval);
    });
  }

  // private incomingMessageHandlers(message:string,websocket:WebSocket)
  // {
  //     let parsedObj:BaseMessage;
  //     try {
  //         parsedObj = JSON.parse(message) as BaseMessage;
  //     } catch (error) {
  //         const errora = error as Error;
  //         console.error(error);
  //         websocket.send("Server Error " + errora.name);
  //         return;
  // }

  // switch (parsedObj.type) {
  //   case RequestType.CREATE:
  //     roomService.createRoom(websocket, (parsedObj as CreateMessage).roomName);
  //     break;
  //   case RequestType.JOIN:
  //     roomService.joinRoom(websocket, (parsedObj as JoinMessage).roomId);
  //     break;
  //   case RequestType.MESSAGE:
  //     roomService.sendMessage(websocket,parsedObj as ChatMessage);
  //     //message on room
  //     break;
  //   case RequestType.RENAME:
  //     roomService.renameUser(websocket, (parsedObj as RenameMessage).username);
  //     break;
  //   case RequestType.LEAVE:
  //   //on request of leave
  //   roomService.leaveRoom(websocket);
  //   break;
  //   default:
  //     websocket.send(
  //       JSON.stringify({ type: "error", message: "Invalid message type" }));
  // }
}
