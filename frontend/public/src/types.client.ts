export type ElementType = "roomId" | "roomName" | "activeMember" | "username" | "userId";
export type InputBoxTypes='JOIN_ROOM_INPUT' | 'CREATE_ROOM_INPUT' | 'MESSAGE_INPUT' | 'USERNAME_INPUT';

export enum RequstType {
  CREATE = "create",
  JOIN = "join",
  MESSAGE = "message",
  RENAME = "rename",
  CONNECT = "connect",
  LEAVE = "leave",
  NOTIFY="notify"
}

export interface BaseMessage{
    type:RequstType,
    message?:string
}

export interface CreateMessage extends BaseMessage{
  type: RequstType.CREATE;
  message?: string;
  roomName: string;
  roomId?: number;
};

export interface JoinMessage extends BaseMessage {
  type: RequstType.JOIN;
  message?: string;
  roomId: number;
  roomName?:string;
  username?: string;
  activeUsers?:number
};

export interface ChatMessage extends BaseMessage {
  type: RequstType.MESSAGE;
  roomId?: number;
  sender?:string,
  message: string;
  id?:string
};

export interface RenameMessage extends BaseMessage {
  type: RequstType.RENAME;
  username: string;
  message?: string;
};

export interface ConnectionMessage extends BaseMessage {
  type: RequstType.CONNECT;
  id: number;
  username: string;
  message: string;
};

export interface LeaveMessage extends BaseMessage{
  type: RequstType.LEAVE;
  roomId: number;
  message?: string;
};

export interface RoomNotificationMessage extends BaseMessage {
  type: RequstType.NOTIFY;
  message: string;
  notificationOf: RequstType.JOIN | RequstType.MESSAGE | RequstType.LEAVE;
   additional?:Record<string,string>
};


export type ButtonHandlerMap = {
  [key: string]: () => void;
};

