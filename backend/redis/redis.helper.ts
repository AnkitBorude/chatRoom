import { Client, Room, ServerInfo, ServerStatsInfo } from "backend/types";
import { RedisClientType } from "redis";
import { RedisUtil } from "./redis.util";
import {
  CLIENT_REDIS_TTL_SEC,
  ROOM_REDIS_TTL_SEC,
  SERVER_STAT_REDIS_TTL_SEC,
} from "@shared/const";

export class RedisHelper {
  redisClient: RedisClientType;
  redisPublisher: RedisClientType;
  redisUtil: RedisUtil;
  constructor(redisClient: RedisClientType, redisPublisher: RedisClientType) {
    this.redisClient = redisClient;
    this.redisPublisher = redisPublisher;
    this.redisUtil = new RedisUtil();
  }

  public async createNewClient(client: Client) {
    const key = this.redisUtil.getClientkey(client.id);
    const stringiFied_client = this.redisUtil.stringifyObject(client);
    await this.redisClient
      .multi()
      .hSet(key, stringiFied_client)
      .expire(key, CLIENT_REDIS_TTL_SEC)
      .exec();
  }

  public async removeClient(clientId: number) {
    const key = this.redisUtil.getClientkey(clientId);
    await this.redisClient.del(key);
  }
  public async getClientById(clientId: number): Promise<Client | undefined> {
    const key = this.redisUtil.getClientkey(clientId);
    const client = await this.redisClient.hGetAll(key);
    //redis returns empty object in case it does not find any hash
    if (Object.keys(client).length === 0) {
      return undefined;
    }
    //typecasting id back to number

    const parsedClient: Client = JSON.parse(JSON.stringify(client));
    parsedClient.id = Number(parsedClient.id);
    if (parsedClient.roomId) {
      parsedClient.roomId = Number(parsedClient.roomId);
    }
    return parsedClient;
  }

  public async createNewRoom(room: Room) {
    //this method create new room and ads the creator in the newly created Room as well
    const key = this.redisUtil.getRoomkey(room.id);
    const stringiFied_room = this.redisUtil.stringifyObject(room);
    await this.redisClient
      .multi()
      .hSet(key, stringiFied_room)
      .expire(key, ROOM_REDIS_TTL_SEC)
      .exec();
  }

  public async getRoomById(roomId: number): Promise<Room | undefined> {
    const key = this.redisUtil.getRoomkey(roomId);
    const room = await this.redisClient.hGetAll(key);
    //redis returns empty object in case it does not find any hash
    if (Object.keys(room).length === 0) {
      return undefined;
    }
    const parsedRoom: Room = JSON.parse(JSON.stringify(room));
    parsedRoom.id = Number(parsedRoom.id);
    parsedRoom.activeUsers = Number(parsedRoom.activeUsers);
    parsedRoom.createdBy = Number(parsedRoom.createdBy);
    return parsedRoom;
  }

  public async addClientInRoom(roomId: number, clientId: number) {
    const chatRoomkey = this.redisUtil.getChatRoomKey(roomId);
    const roomKey = this.redisUtil.getRoomkey(roomId);
    const clientKey = this.redisUtil.getClientkey(clientId);

    await this.redisClient
      .multi()
      .sAdd(chatRoomkey, [String(clientId)])
      .hSet(clientKey, "roomId", roomId)
      .hIncrBy(roomKey, "activeUsers", 1)
      .sCard(chatRoomkey)
      .expire(chatRoomkey, ROOM_REDIS_TTL_SEC, "NX")
      .exec();
  }

  // EXEC returns an array of replies, where every element is the reply of a
  // single command in the transaction, in the same order the commands were issued.
  public async removeClientFromRoom(
    roomId: number,
    clientId: number,
    isRoomRemoved?: boolean,
  ) {
    const chatRoomkey = this.redisUtil.getChatRoomKey(roomId);
    const roomKey = this.redisUtil.getRoomkey(roomId);
    const clientKey = this.redisUtil.getClientkey(clientId);

    if (isRoomRemoved) {
      return await this.redisClient
        .multi()
        .sRem(chatRoomkey, [String(clientId)])
        .hDel(clientKey, "roomId")
        .exec();
    }
    return await this.redisClient
      .multi()
      .sRem(chatRoomkey, [String(clientId)])
      .hDel(clientKey, "roomId")
      .hIncrBy(roomKey, "activeUsers", -1)
      .sCard(chatRoomkey)
      .exec();
  }

  public async updateClient(clientId: number, update: Partial<Client>) {
    if ("id" in update || "createdAt" in update) {
      throw new Error("Cannot update id and create timestamp of Client");
    }
    const stringiFied_client = this.redisUtil.stringifyObject(update);
    const key = this.redisUtil.getClientkey(clientId);
    await this.redisClient.hSet(key, stringiFied_client);
  }

  public async publishMessage(roomId: number, message: string) {
    const key = this.redisUtil.getRoomkey(roomId);
    return await this.redisClient.publish(key, message);
  }

  public async removeEmptyRoom(roomId: number) {
    const key = this.redisUtil.getRoomkey(roomId);
    const chatRoomkey = this.redisUtil.getChatRoomKey(roomId);
    await this.redisClient.multi().del(key).del(chatRoomkey).exec();
  }

  public async subscribeToChatRoomPipeline(
    roomId: number,
    cb: (message: string) => void,
  ) {
    const key = this.redisUtil.getRoomkey(roomId);
    return this.redisPublisher.subscribe(key, (message) => {
      cb(message);
    });
  }

  public async unSubscribeToChatRoomPipeline(roomId: number) {
    console.log("Unsubscribing to global pipline " + roomId);
    const key = this.redisUtil.getRoomkey(roomId);
    await this.redisPublisher.unsubscribe(key);
  }

  public async addServer(serverId: string, serverInfo: ServerInfo) {
    const key = this.redisUtil.getServerSetKey(serverId);
    const stringiFied_server = this.redisUtil.stringifyObject(serverInfo);
    await this.redisClient
      .multi()
      .hSet(key, stringiFied_server)
      .expire(key, SERVER_STAT_REDIS_TTL_SEC)
      .exec();
  }

  public async updateServerStats(
    serverId: string,
    serverStats: ServerStatsInfo,
  ) {
    const key = this.redisUtil.getServerSetKey(serverId);
    const stringiFied_server = this.redisUtil.stringifyObject(serverStats);
    await this.redisClient.hSet(key, stringiFied_server);
  }
  public async removeServerId(serverId: string) {
    const key = this.redisUtil.getServerSetKey(serverId);
    await this.redisClient.del(key);
  }
}
