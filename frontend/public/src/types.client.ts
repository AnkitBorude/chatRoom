export type ElementType =
  | "roomId"
  | "roomName"
  | "activeMember"
  | "username"
  | "userId";
export type InputBoxTypes =
  | "JOIN_ROOM_INPUT"
  | "CREATE_ROOM_INPUT"
  | "MESSAGE_INPUT"
  | "USERNAME_INPUT";

export type ButtonHandlerMap = {
  [key: string]: () => void;
};
