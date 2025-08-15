import { BaseMessage, RoomNotificationMessage } from "@shared/message.type";
import { RequestType } from "@shared/request.enum";
import crypto from "crypto";
export class ChatRoomUtility {
  constructor() {}

  public generateNewClientId() {
    return crypto.randomInt(10000, 99999);
  }

  public generateNewRoomId() {
    return crypto.randomInt(10000, 99999);
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
}
