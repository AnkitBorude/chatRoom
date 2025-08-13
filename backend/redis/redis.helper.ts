import { clientType } from "backend/types";
import { RedisClientType } from "redis";

export class RedisHelper{
    redisClient:RedisClientType;
    private CLIENT_KEY_INITIALIZER='client:<id>';
    constructor(redisClient:RedisClientType)
    {
        this.redisClient=redisClient;
    }

    public async createNewClient(id:number,name:string)
    {
        const key=this.getClientkey(id);
        const clientMeta:clientType={
            id,name,
            createdAt:new Date(),
            roomId:0
        }
        await this.redisClient.hSet(key,clientMeta);
    }

    private getClientkey(key:number)
    {
        return this.CLIENT_KEY_INITIALIZER.replace('<id>',key.toString())
    }
}