import { RedisClientType } from "redis";
import { RedisUtil } from "../redis/redis.util";

export class RedisAdminHelper{

    private redisClient:RedisClientType;
    private redisUtil:RedisUtil;
    constructor(redis:RedisClientType)
    {
        this.redisClient=redis;
        this.redisUtil = new RedisUtil();
    }
}