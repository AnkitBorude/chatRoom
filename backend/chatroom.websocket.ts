import http from "http";
import { RedisClientType } from "redis";
import WebSocket from "ws";
import crypto from "crypto";
import { error } from "console";
export class ChatRoomWebsocket{
    private client:RedisClientType;
    private subscriber:RedisClientType;
    private websocketServer:WebSocket.Server;
    constructor(server:http.Server,client:RedisClientType,subscriber:RedisClientType)
    {
        this.client=client;
        this.websocketServer=new WebSocket.Server({server});
        this.subscriber=subscriber;
    }

    private initialize()
    {
        this.websocketServer.on('connection',(websocket)=>{
            //Client connected to server
            websocket.on('message',(incomingMessage)=>this.messageHandlers(incomingMessage));
        });

        this.websocketServer.on('error',(error)=>{
            console.log("Something went wrong with websocket "+error.message);
        })
    }

    private generateNewClientId()
    {
        return crypto.randomInt(10000,99999);
    }

    private messageHandlers(message:string)
    {
        
    }

}