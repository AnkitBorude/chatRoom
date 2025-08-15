import { BaseMessage } from "@shared/message.type";
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
}
