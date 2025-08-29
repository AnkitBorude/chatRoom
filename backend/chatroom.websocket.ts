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
import winston from "winston";
export class ChatRoomWebsocket {
  private websocketServer: WebSocket.Server;
  private roomManager: RoomManager;
  private connectionLifeMap: Map<WebSocket, boolean>;
  private readonly PING_INTERVAL_SEC: number = 30;
  private redisHelper: RedisHelper;
  private serverId: string = crypto.randomUUID();
  private adminController: AdminController | undefined;
  private adminAccess: boolean = false;
  private _logger;
  constructor(
    server: http.Server,
    client: RedisClientType,
    subscriber: RedisClientType,
  ) {
    this._logger=this.createLogger();
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
      this._logger.info("Websocket started Listenin");
    });
    this.websocketServer.on("connection", (websocket,req) => {
      const ip=this.extractIp(req);
      // Client connected to server
      this.roomManager.createClient(websocket,ip);
      this.connectionLifeMap.set(websocket, true);

      //I can also store and limit number of socket connections from one ip and more

      this._logger.info("New websocket connection ",{ip});

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
      this._logger.error("Something went wrong with server " + error.message);
    });

    const pingInterval = setInterval(() => {
      this.connectionLifeMap.forEach((isAlive, socket, map) => {
        if (isAlive) {
          socket.ping();
          map.set(socket, false);
        } else {
          //if the connection is dead remove the socket and
          //cleanup the memory(remove client from the room if any)
          this._logger.warn("Dead Connection Found no response since "+this.PING_INTERVAL_SEC * 1000);
          this.roomManager.removeClient(socket);
          socket.terminate();
          map.delete(socket);
          this._logger.info("Removed Dead Connection ")
        }
      });
    }, this.PING_INTERVAL_SEC * 1000);

    const serverUpdateInterval = setInterval(async () => {
      const stats = this.roomManager.getStatistics();
      try {
        await this.redisHelper.updateServerStats(this.serverId, stats);
        this._logger.info("Server stats updated sucessfully",{stats});
      } catch (error) {
        this._logger.error("Error while sending stats update to redis "+(error as Error).name);
        console.error(error);
      }
    }, SERVER_STAT_UPDATE_INTERVAL_SEC * 1000);

    this.websocketServer.on("close", async () => {
      this._logger.warn("Closing websocket server");
      clearInterval(pingInterval);
      clearInterval(serverUpdateInterval);
      await this.redisHelper.removeServerId(this.serverId);
      this._logger.info("Websocket server closed successfully");
    });

    if (this.adminController) {
      this._logger.info("Server has authorized admin access");
      try {
        this.adminController.startListening(this.serverId);
        this.adminAccess = true;
      } catch (error) {
        this._logger.error("Error in admin access control error "+(error as Error).name);
        console.error(error);
      }
    }
  }

  private incomingMessageHandlers(message: string, websocket: WebSocket) {
    let parsedObj: BaseMessage;
    try {
      parsedObj = JSON.parse(message) as BaseMessage;
    } catch (error) {
      const errora = error as Error;
      this._logger.error("Invalid incoming request message json type error "+errora.name);
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
          JSON.stringify({ type: "error", message: "Invalid message type request message type does not exists" }),
        );
        this._logger.error("Invalid requested Message format and message type");
    }
  }

  get hasAdminAccess(): boolean {
    return this.adminAccess;
  }

  //to be called externally
  public async closeSocket() {
    const message = JSON.stringify({
      type: "error",
      message: "Server Disconnected retry after some time",
    });
    this.connectionLifeMap.forEach((value, ws) => {
      if (value) {
        ws.send(message);
        //closing websocket thus the server will do other side-effects of removing
        //clients from the server and rooms;
        ws.close();
      }
    });
    this.websocketServer.close();
  }

   private createLogger()
    {
       return winston.createLogger({
            transports:[
              new winston.transports.Console()
            ],
            format:winston.format.combine(
              winston.format.label({label:'ChatRoomSocket'}),
              winston.format.timestamp(),
              winston.format.prettyPrint()
            )
          });
    }

      public extractIp(req: http.IncomingMessage):string
      {
        const ip = req.headers["x-real-ip"];
        if (ip) {
          //accept first duplicate header value only fallabck to 0.0.0.0
          return ip[0] || "0.0.0.0";
        } else {
          return req.socket.remoteAddress || "0.0.0.0";
        }
      }
}
