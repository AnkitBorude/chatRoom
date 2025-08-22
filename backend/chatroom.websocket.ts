import http from "http";
import { RedisClientType } from "redis";
import WebSocket from "ws";
import { RoomManager } from "./service/chatroom.service";
import crypto from "crypto";
import os from "os";
import {
  BaseMessage,
  ChatMessage,
  CreateMessage,
  JoinMessage,
  RenameMessage,
} from "@shared/message.type";
import { RequestType } from "@shared/request.enum";
import { RedisHelper } from "./redis/redis.helper";
import { ServerInfo } from "./types";
import { SERVER_STAT_UPDATE_INTERVAL_SEC } from "@shared/const";
import { AdminController } from "./admin/admin.controller";
export class ChatRoomWebsocket {
  private websocketServer: WebSocket.Server;
  private roomManager: RoomManager;
  private connectionLifeMap: Map<WebSocket, boolean>;
  private readonly PING_INTERVAL_SEC: number = 30;
  private redisHelper: RedisHelper;
  private serverId: string = crypto.randomUUID();
  private adminController: AdminController | undefined;
  private adminAccess: boolean = false;
  constructor(
    server: http.Server,
    client: RedisClientType,
    subscriber: RedisClientType,
  ) {
    this.websocketServer = new WebSocket.Server({ server });
    this.redisHelper = new RedisHelper(client, subscriber);
    //generate New ServerId
    this.roomManager = new RoomManager(this.redisHelper, this.serverId);
    this.connectionLifeMap = new Map();
    this.adminController = AdminController.getInstance(server, client);
  }
  public async initialize() {
    const info: ServerInfo = {
      serverId: this.serverId,
      host: os.hostname(),
      env: process.env.NODE_ENV || "unknown",
      startedAt: Date.now(),
      activeConnections: 0,
      totalRooms: 0,
      lastUpdatedAt: Date.now(),
      port: 3000,
      totalMessagesReceived: 0,
      totalMessagesSent: 0,
      leakyConnections: 0,
      totalRoomsCreated: 0,
    };

    this.redisHelper.addServer(this.serverId, info);

    this.websocketServer.on("listening", () => {
      console.log("Websocket server is listening now");
    });
    this.websocketServer.on("connection", (websocket) => {
      // Client connected to server
      this.roomManager.createClient(websocket);
      this.connectionLifeMap.set(websocket, true);

      websocket.on("pong", () => {
        this.connectionLifeMap.set(websocket, true);
      });

      websocket.on("close", () => {
        this.connectionLifeMap.delete(websocket);
      });
      websocket.on("message", (incomingMessage) =>
        this.incomingMessageHandlers(
          incomingMessage.toString("utf-8"),
          websocket,
        ),
      );
    });

    this.websocketServer.on("error", (error) => {
      console.log("Something went wrong with server " + error.message);
    });

    const pingInterval = setInterval(() => {
      this.connectionLifeMap.forEach((isAlive, socket, map) => {
        if (isAlive) {
          socket.ping();
          map.set(socket, false);
        } else {
          //if the connection is dead remove the socket and
          //cleanup the memory(remove client from the room if any)
          console.log("Cleaning up dead connection");
          this.roomManager.removeClient(socket);
          socket.terminate();
          map.delete(socket);
        }
      });
    }, this.PING_INTERVAL_SEC * 1000);

    const serverUpdateInterval = setInterval(async () => {
      const stats = this.roomManager.getStatistics();
      try {
        await this.redisHelper.updateServerStats(this.serverId, stats);
      } catch (error) {
        console.log("Error while updating server stats in redis");
        console.error(error);
      } finally {
        console.log("Update Sent to server");
      }
    }, SERVER_STAT_UPDATE_INTERVAL_SEC * 1000);

    this.websocketServer.on("close", async () => {
      clearInterval(pingInterval);
      clearInterval(serverUpdateInterval);
      await this.redisHelper.removeServerId(this.serverId);
    });

    if (this.adminController) {
      console.log("Type of" + typeof this.adminController);
      console.log("Container has admin endpoints accessible..");

      try {
        this.adminController.startListening(this.serverId);
        this.adminAccess = true;
      } catch (error) {
        console.log(error);
      }
    }
  }

  private incomingMessageHandlers(message: string, websocket: WebSocket) {
    let parsedObj: BaseMessage;
    try {
      parsedObj = JSON.parse(message) as BaseMessage;
    } catch (error) {
      const errora = error as Error;
      console.error(error);
      websocket.send(
        "Server Error during parsing message object " + errora.name,
      );
      return;
    }

    switch (parsedObj.type) {
      case RequestType.CREATE:
        this.roomManager.createRoom(websocket, parsedObj as CreateMessage);
        break;
      case RequestType.JOIN:
        this.roomManager.joinRoom(websocket, parsedObj as JoinMessage);
        break;
      case RequestType.MESSAGE:
        this.roomManager.sendMessage(websocket, parsedObj as ChatMessage);
        //message on room
        break;
      case RequestType.RENAME:
        this.roomManager.renameUser(websocket, parsedObj as RenameMessage);
        break;
      case RequestType.LEAVE:
        //on request of leave
        this.roomManager.leaveRoom(websocket);
        break;

      default:
        websocket.send(
          JSON.stringify({ type: "error", message: "Invalid message type" }),
        );
        console.log("Invalid Message type");
    }
  }

  get hasAdminAccess(): boolean {
    return this.adminAccess;
  }
}
