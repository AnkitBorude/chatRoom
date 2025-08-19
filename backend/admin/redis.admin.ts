import { RedisClientType } from "redis";
import { RedisUtil } from "../redis/redis.util";

export class RedisAdminHelper {
  private redisClient: RedisClientType;
  private redisUtil: RedisUtil;
  constructor(redis: RedisClientType) {
    this.redisClient = redis;
    this.redisUtil = new RedisUtil();
  }

  public async removeClient(id: number) {
    const key = this.redisUtil.getClientkey(id);
    return await this.redisClient.del(key);
  }
  public async removeRoom(id: number) {
    const key = this.redisUtil.getRoomkey(id);
    return await this.redisClient.del(key);
  }
  public async getRoom(id: number) {
    const key = this.redisUtil.getRoomkey(id);
    return await this.redisClient.hGetAll(key);
  }

  public async getClient(id: number) {
    const key = this.redisUtil.getClientkey(id);
    return await this.redisClient.hGetAll(key);
  }

  public async getAllServers() {
    const ids = await this.redisClient.keys(
      this.redisUtil.getServerSetKey("*"),
    );
    const result: Record<string, Record<string, string>> = {};
    for (const id of ids) {
      const data = await this.redisClient.hGetAll(id);
      result[id] = data;
    }
    return result;
  }

  public async getAllClientIds() {
    const ids = await this.redisClient.keys(this.redisUtil.getClientkey("*"));
    const idsNum: number[] = [];
    for (const id of ids) {
      idsNum.push(Number(id.split(":")[1]));
    }
    return idsNum;
  }

  public async getAllRoomIds() {
    const ids = await this.redisClient.keys(this.redisUtil.getRoomkey("*"));
    const idsNum: number[] = [];
    for (const id of ids) {
      idsNum.push(Number(id.split(":")[1]));
    }
    return idsNum;
  }
}
