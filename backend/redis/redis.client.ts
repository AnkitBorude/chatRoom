import {
  MAX_REDIS_HEARTBEAT_INTERVAL_SEC,
  MAX_REDIS_HEARTBEAT_RETRY,
} from "@shared/const";
import { createClient, RedisClientType } from "redis";

export class RedisClientWrapper {
  //here using the redisClient type really made my machine very slow because of deep nested
  //overloading and types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: undefined | any;

  private pingInterval: NodeJS.Timeout | undefined = undefined;
  isRedisHealthy: boolean = false;
  private RETRY: number = MAX_REDIS_HEARTBEAT_RETRY;
  private _name: string = "default";

  constructor(name?: string) {
    if (name) {
      this._name = name;
    }
    if (!this.client) {
      this.client = createClient({
        socket: {
          host: "host.docker.internal",
        },
      });
      this.client.on("error", this.handleError);
      this.client.on("connect", () => {
        console.log("📡 Redis socket connected. NAME: " + this._name);
      });
      this.client.on("reconnecting", () => {
        if (this.RETRY <= 0) {
          console.log(
            "Retried too many time Exiting the process NAME: " + this._name,
          );
          process.exit(-1);
        }
        console.log("🔄 Redis is reconnecting...");
        this.RETRY--;
      });
    }
  }

  public async connect(): Promise<undefined | RedisClientType> {
    if (this.client.isOpen) {
      console.log("Already Open Connection NAME: " + this._name);
      return;
    }
    try {
      await this.client?.connect();
      this.startHeartbeat(MAX_REDIS_HEARTBEAT_INTERVAL_SEC * 1000);

      return this.client;
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public get name() {
    return this._name;
  }

  set name(name: string) {
    this._name = name;
  }

  private startHeartbeat(interval: number) {
    this.pingInterval = setInterval(
      async () => await this.pingClient(),
      interval,
    );
  }
  private handleError(error: Error) {
    console.log("Error in while connecting to redis NAME : " + this._name);
    console.log(`Error in NAME: ${this._name} ERROR: ${error.message}`);
  }

  private async pingClient() {
    try {
      await this.client!.ping();
    } catch (error) {
      console.error("Error in Network pinging failed");
      this.handleError(error as Error);
      this.client!.destroy();
      clearInterval(this.pingInterval);
      console.error("Reconnecting once");
      await this.connect();
    }
  }

  public async closeClient() {
    if (this.client.isOpen) {
      await this.client.quit();
      console.log("Redis connection closed");
    }
  }
}
