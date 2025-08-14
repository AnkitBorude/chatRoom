import { Client } from "backend/types";
import { RedisClientType } from "redis";
import { RedisUtil } from "./redis.util";

export class RedisHelper {
  redisClient: RedisClientType;
  redisUtil:RedisUtil;
  constructor(redisClient: RedisClientType) {
    this.redisClient = redisClient;
    this.redisUtil=new RedisUtil();
  }

  public async createNewClient(client: Client) {
    const key = this.redisUtil.getClientkey(client.id);
    const stringiFied_client=this.redisUtil.stringifyObject(client);
    await this.redisClient.hSet(key,stringiFied_client);
  }
  

}
