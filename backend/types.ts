// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Client {
  id: number;
  name: string;
  createdAt: Date;
  roomId?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Room extends Record<string, any> {
  id: number;
  name: string;
}
