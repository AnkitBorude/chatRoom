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

export type ServerInfo = {
  serverId: string;
  host?: string;
  port: number;
  env: string;
  startedAt: number;
  activeConnections: number;
  totalRooms: number;
  totalMessagesSent?: number;
  totalMessagesReceived?: number;
  lastUpdatedAt: number;
};
