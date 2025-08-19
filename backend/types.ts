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
  leakyConnections?: number;
  totalRoomsCreated?: number;
};

export type ServerStatsInfo = Pick<
  ServerInfo,
  | "activeConnections"
  | "lastUpdatedAt"
  | "leakyConnections"
  | "totalRoomsCreated"
  | "totalMessagesReceived"
  | "totalRooms"
  | "totalMessagesSent"
>;

export enum TOKENTYPE {
  ADMIN_USER='ADMIN_USER',
  ADMIN_PASS='ADMIN_PASS',
  JWT_SECRET='JWT_SECRET'
}

