import {
  CLIENT_BANNED_CODE,
  CLIENT_ID_MAX,
  CLIENT_ID_MIN,
  ROOM_ID_MIN,
  ROOO_ID_MAX,
} from "@shared/const";
import { BaseMessage, RoomNotificationMessage } from "@shared/message.type";
import { RequestType } from "@shared/request.enum";
import crypto from "crypto";
import winston from "winston";
export class ChatRoomUtility {
  private _logger;
  constructor() {
    this._logger=winston.createLogger({
          transports:[
            new winston.transports.Console()
          ],
          format:winston.format.combine(
            winston.format.json(),
            winston.format.timestamp(),
            winston.format.label({label:'ChatRoom'})
          )
        })
  }

  public generateNewClientId() {
    return crypto.randomInt(CLIENT_ID_MIN, CLIENT_ID_MAX);
  }

  public generateNewRoomId() {
    return crypto.randomInt(ROOM_ID_MIN, ROOO_ID_MAX);
  }
  public generateMessageString<T extends BaseMessage>(message: T) {
    return JSON.stringify(message);
  }

  public createClientNotificationofMessage(
    message: string,
    type: RequestType,
    additional?: Record<string, string>,
  ) {
    const notification: RoomNotificationMessage = {
      message: message.trim(),
      notificationOf: type,
      type: RequestType.NOTIFY,
      additional,
    };
    return notification;
  }

  public appendUUIDtoMessage(uuid: string, message: string) {
    //here with each serialized json message we are appending the server uuid to filer loopback after subscription
    return message + ">" + uuid;
  }
  public retrieveUUIDandMessage(message: string): [string, string] {
    //retrieving uuid and message from received message
    const lastIndex = message.lastIndexOf("}");
    if (message[lastIndex + 1] !== ">") {
      throw new Error("Invalid Message format");
    }

    const uuid = message.slice(lastIndex + 2);
    const rmessage = message.slice(0, lastIndex + 1);

    return [uuid, rmessage];
  }

  public createNotFoundMessage() {
    const message = this.createClientNotificationofMessage(
      "You have been removed from server by System/ Admin.Kindly rejoin",
      RequestType.MESSAGE,
      { messageId: CLIENT_BANNED_CODE },
    );
    return JSON.stringify(message);
  }


  public getLogger()
    {
      return {
        warn:(message:string,clientId:number,type:RequestType)=>{
          this._logger.warn(message,{clientId,type});
        },
         error:(message:string,clientId:number,type:RequestType)=>{
           this._logger.error(message,{clientId,type});
        },
         info:(message:string,clientId:number,type:RequestType)=>{
           this._logger.info(message,{clientId,type});
        },
        native:this._logger
      }
    }
}
