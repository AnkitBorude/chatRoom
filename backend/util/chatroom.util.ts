import { CLIENT_ID_MAX, CLIENT_ID_MIN, ROOM_ID_MIN, ROOO_ID_MAX } from "@shared/const";
import { BaseMessage, RoomNotificationMessage } from "@shared/message.type";
import { RequestType } from "@shared/request.enum";
import crypto from "crypto";
export class ChatRoomUtility {
  constructor() {}

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

  public appendUUIDtoMessage(uuid:string,message:string)
  {
    return message+">"+uuid;
  }
  public retrieveUUIDandMessage(message:string):[string,string]
  {
    const lastIndex=message.lastIndexOf('}');
    if(message[lastIndex+1]!=='>')
    {
      throw new Error("Invalid Message format");
    }

    const uuid=message.slice(lastIndex+2);
    const rmessage=message.slice(0,lastIndex+1);

    return [uuid,rmessage];
  }

  public createNotFoundMessage()
  {
    
  }
}
