import { Client,Room } from "backend/types";
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
  public async getClientById(clientId:number):Promise<Client | undefined>
  {
    const key=this.redisUtil.getClientkey(clientId);
    const client=await this.redisClient.hGetAll(key);
    //redis returns empty object in case it does not find any hash
    if (Object.keys(client).length === 0) {
      return undefined}
    return JSON.parse(JSON.stringify(client));
  }

  public async createNewRoom(room:Room)
  {
    //this method create new room and ads the creator in the newly created Room as well
    const key=this.redisUtil.getRoomkey(room.id);
    const stringiFied_room=this.redisUtil.stringifyObject(room);
    await this.redisClient.hSet(key,stringiFied_room);

    await this.addClientInRoom(room.id,room.createdBy);
  }

  public async getRoomById(roomId:number):Promise<Room | undefined>
  {
    
    const key=this.redisUtil.getRoomkey(roomId);
    const client=await this.redisClient.hGetAll(key);
    //redis returns empty object in case it does not find any hash
    if (Object.keys(client).length === 0) {
      return undefined}
    return JSON.parse(JSON.stringify(client));
  }

  public async addClientInRoom(roomId:number,clientId:number){
    const key=this.redisUtil.getChatRoomKey(roomId);
    await this.redisClient.sAdd(key,[String(clientId)]);
    await this.updateClient(clientId,{roomId});
  }

  public async updateClient(clientId:number,update:Partial<Client>)
  {
    if('id' in update || 'createdAt' in update)
    {
      throw new Error("Cannot update id and create timestamp of Client");
    }
     const stringiFied_client=this.redisUtil.stringifyObject(update);
      const key=this.redisUtil.getClientkey(clientId);
     await this.redisClient.hSet(key,stringiFied_client);
  }

  public async publishMessage(roomId:number,message:string)
  {
    const key=this.redisUtil.getRoomkey(roomId);
    return await this.redisClient.publish(key,message);
  }
  

}
