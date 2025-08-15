import { RequestType } from "./request.enum";

export interface BaseMessage {
  type: RequestType;
  message: string;
}

export interface CreateMessage extends BaseMessage {
  type: RequestType.CREATE;
  message: string;
  roomName: string;
  roomId: number;
}

export interface JoinMessage extends BaseMessage {
  type: RequestType.JOIN;
  message: string;
  roomId: number;
  roomName: string;
  username: string;
  activeUsers: number;
}

export interface ChatMessage extends BaseMessage {
  type: RequestType.MESSAGE;
  roomId: number;
  message: string;
  sender: string;
  id?: string;
}

export interface RenameMessage extends BaseMessage {
  type: RequestType.RENAME;
  username: string;
  message: string;
}

export interface ConnectionMessage extends BaseMessage {
  type: RequestType.CONNECT;
  id: number;
  username: string;
  message: string;
}

export interface LeaveMessage extends BaseMessage {
  type: RequestType.LEAVE;
  roomId: number;
  message: string;
}

export interface RoomNotificationMessage extends BaseMessage {
  type: RequestType.NOTIFY;
  message: string;
  notificationOf: RequestType;
  additional?: Record<string, string>;
}
