export interface Client {
  id: number;
  name: string;
  createdAt: Date;
  roomId?: number;
}
export interface Room {
  id: number;
  name: string;
  createdAt: Date;
  activeUsers: number;
  createdBy: number;
}
