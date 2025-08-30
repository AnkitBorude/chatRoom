import {
  MAX_REDIS_HEARTBEAT_INTERVAL_SEC,
  MAX_REDIS_HEARTBEAT_RETRY,
} from "@shared/const";
import { createClient, RedisClientType } from "redis";
import winston from "winston";

export class RedisClientWrapper {
  //here using the redisClient type really made my machine very slow because of deep nested
  //overloading and types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: undefined | any;

  private pingInterval: NodeJS.Timeout | undefined = undefined;
  isRedisHealthy: boolean = false;
  private RETRY: number = MAX_REDIS_HEARTBEAT_RETRY;
  private _name: string = "default";
  private _logger: winston.Logger;

  constructor(name?: string) {
    this._logger=this.createLogger();
    if (name) {
      this._name = name;
    }
    if (!this.client) {
      this.client = createClient({
        socket: {
          host: "redis",
        },
      });
      this.client.on("error", this.handleError);
      this.client.on("connect", () => {
        this._logger.info("Redis Connected Successfully ",{connection:this._name});
      });
      this.client.on("reconnecting", () => {
        if (this.RETRY <= 0) {
          this._logger.error("Retried too many time Exiting process",{connection:this._name});
          process.exit(-1);
        }
        this._logger.info("Redis Reconnecting... retry "+this.RETRY,{connection:this._name});
        this.RETRY--;
      });
    }
  }

  public async connect(): Promise<undefined | RedisClientType> {
    if (this.client.isOpen) {
      this._logger.warn("Redis Connection is already open ",{connection:this._name});
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
    this._logger.info("Started Redis Heartbeat with interval of "+interval,{connection:this._name});
    this.pingInterval = setInterval(
      async () => await this.pingClient(),
      interval,
    );
  }
  private handleError(error: Error) {
    this._logger.error("Error while connecting to redis.. message "+error.message,{connection:this._name});
  }

  private async pingClient() {
    try {
      await this.client!.ping();
    } catch (error) {

      this._logger.error("Redis Error in Network pinging failed",{connection:this._name});
      this.handleError(error as Error);
      this.client!.destroy();
      clearInterval(this.pingInterval);
      
      this._logger.warn("Retrying to reconnect again to redis ",{connection:this._name});
      await this.connect();
    }
  }

  public async closeClient() {
    if (this.client.isOpen) {
      await this.client.quit();
      this._logger.warn("Redis Connection Closed Gracefully");
    }
  }

  private createLogger()
  {
     return winston.createLogger({
          transports:[
            new winston.transports.Console()
          ],
          format:winston.format.combine(
            winston.format.json(),
            winston.format.timestamp(),
            winston.format.label({label:'Redis'})
          )
        });
  }
}
