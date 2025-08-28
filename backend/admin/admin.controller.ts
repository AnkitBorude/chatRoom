import http from "http";
import { JWTTokenManager } from "./jwt.util";
import { TOKENTYPE } from "backend/types";
import { AdminHelperUtility } from "./admin.util";
import { RedisAdminHelper } from "backend/redis/admin/redis.admin";
import { RedisClientType } from "redis";
import { MAX_REQUEST_WITHIN_1_MIN } from "@shared/const";
import * as dotenv from "dotenv";
import path from "path";
//local only
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
export class AdminController {
  private serverId: string = "";
  private static REQUIRED_ENV_VARIABLES = [
    "ADMIN_USER",
    "ADMIN_PASS",
    "JWT_SECRET",
  ];
  private static environment: Record<TOKENTYPE, string> = {
    ADMIN_PASS: "abc",
    ADMIN_USER: "user",
    JWT_SECRET: "secret",
  };
  private readonly RATE_LIMIT_MAX_CONCURRENT_TOKENS = 2;
  private readonly TOKEN_REFILLING_INTERVAL_SEC = 5;
  private rateLimitToken: number = this.RATE_LIMIT_MAX_CONCURRENT_TOKENS;

  private tokenManager: JWTTokenManager;
  private adminHelper: AdminHelperUtility;
  private redis: RedisAdminHelper;
  private logger;
  private constructor(
    private server: http.Server,
    redisClient: RedisClientType,
  ) {
    this.adminHelper = new AdminHelperUtility();
    this.tokenManager = new JWTTokenManager(AdminController.environment,this.adminHelper);
    this.redis = new RedisAdminHelper(redisClient);
    this.logger=this.adminHelper.getLogger();
    setInterval(() => {
      if (this.rateLimitToken < this.RATE_LIMIT_MAX_CONCURRENT_TOKENS) {
        this.rateLimitToken++;
      }
    }, this.TOKEN_REFILLING_INTERVAL_SEC * 1000);
  }
  static getInstance(
    server: http.Server,
    redisClient: RedisClientType,
  ): AdminController | undefined {
    for (const variable of Object.keys(TOKENTYPE)) {
      if (!process.env[variable]) {
        console.log(
          "enviroment variable " +
            variable +
            " Not found thus restricted admin control",
        );
        return undefined;
      }
      this.environment[variable as TOKENTYPE] = process.env[variable];
    }
    Object.freeze(this.environment);
    return new AdminController(server, redisClient);
  }

  public startListening(serverId: string) {
    this.serverId = serverId;
    this.server.on("request", async (req, res) => {
      if (req.url?.startsWith("/admin")) {
        if (!(await this.checkRate(req, res))) return;
        if (req.url === "/admin/login" && req.method === "POST") {
          await this.loginAdmin(req, res);
          return;
        }

        if (!(await this.checkAuth(req, res))) return;

        if (req.url === "/admin/servers" && req.method === "GET") {
         
          await this.getAllServerInfo(res);
          this.logger.info("Server Info Fetched",req);
          return;
        }

        if (req.url === "/admin/rooms" && req.method === "GET") {
          await this.getAllRooms(res)
          this.logger.info("All room info fetched",req);
          return;
        }

        if (req.url === "/admin/clients" && req.method === "GET") {
          await this.getAllClients(res);
          this.logger.info("All client info fetched",req);
          return;
        }

        // DELETE /admin/client/:id
        if (req.url?.startsWith("/admin/client/") && req.method === "DELETE") {
          const id = parseInt(req.url.split("/").pop()!);
          await this.deleteClient(res, id);
          this.logger.info("Delete Client bearing ID "+id,req);
          return;
        }

        // DELETE /admin/room/:id
        if (req.url?.startsWith("/admin/room/") && req.method === "DELETE") {
          const id = parseInt(req.url.split("/").pop()!);
          await this.deleteRoom(res, id);
          this.logger.info("Delete Room bearing ID "+id,req);
          return;
        }

        // GET /admin/room/:id
        if (req.url?.startsWith("/admin/room/") && req.method === "GET") {
          const id = parseInt(req.url.split("/").pop()!);
          await this.getRoom(res, id);
          this.logger.info("Fetched Room metdata bearing ID"+id,req);
          return;
        }

        // GET /admin/client/:id
        if (req.url?.startsWith("/admin/client/") && req.method === "GET") {
          const id = parseInt(req.url.split("/").pop()!);
          await this.getClient(res, id);
          this.logger.info("Fetched Client metadata of bearing ID"+id,req);
          return;
        }

        // if any request other than this just ignore
        res
          .writeHead(404)
          .end("given " + req.url + " not found kindly check documentation");

        this.logger.warn("Admin url "+req.url+"not found",req);

        return;
      }
    });
  }

  private async loginAdmin(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    let body;
    try {
      body = await this.adminHelper.getBody(req);
    } catch (err) {
      console.log(err);
      if (String(err) === "413") {
        // payload was too large or invalid JSON
        this.logger.error("Payload was too large ",req);
        res.writeHead(413).end("payload was too large ");
        return;
      }
      this.logger.error("Invalid JSON Format ",req);
      res.writeHead(400).end("invalid JSON");
      return;
    }

    if (
      body.username === AdminController.environment.ADMIN_USER &&
      body.password === AdminController.environment.ADMIN_PASS
    ) {
      const token = this.tokenManager.signToken(body.username, this.serverId);
      return res.end(JSON.stringify({ token }));
    }
    this.logger.warn("Invalid Credentials",req);
    res.writeHead(401).end("invalid credentials");
  }

  private async deleteClient(res: http.ServerResponse, id: number) {
    const totalRemoved = await this.redis.removeClient(Number(id));
    res
      .writeHead(200)
      .end(JSON.stringify({ totalRemoved, message: "Client removed" }));
  }

  private async deleteRoom(res: http.ServerResponse, id: number) {
    const totalRemoved = await this.redis.removeRoom(Number(id));
    res
      .writeHead(200)
      .end(JSON.stringify({ totalRemoved, message: "Room removed" }));
  }

  private async getRoom(res: http.ServerResponse, id: number) {
    const data = await this.redis.getRoom(id);
    if (Object.keys(data).length === 0) {
      return res.writeHead(404).end("room not found");
    }
    res.writeHead(200).end(JSON.stringify(data));
  }

  private async getClient(res: http.ServerResponse, id: number) {
    const data = await this.redis.getClient(id);
    if (Object.keys(data).length === 0) {
      return res.writeHead(404).end("client not found");
    }
    res.writeHead(200).end(JSON.stringify(data));
  }

  private async getAllServerInfo(res: http.ServerResponse) {
    // first get all serverIds in the set
    const data = await this.redis.getAllServers();
    res.writeHead(200).end(JSON.stringify(data));
  }

  private async getAllClients(res: http.ServerResponse) {
    const data = await this.redis.getAllClientIds();
    res.writeHead(200).end(JSON.stringify({ client_ids: data }));
  }

  private async getAllRooms(res: http.ServerResponse) {
    const data = await this.redis.getAllRoomIds();
    res.writeHead(200).end(JSON.stringify({ room_ids: data }));
  }

  private async checkAuth(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<boolean> {
    // JWT
    if (!this.tokenManager.isAuthenticated(req)) {
      res.writeHead(401).end("unauthorized access token required");
      return false;
    }
    return true;
  }

  private async checkRate(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<boolean> {
    const ip=this.adminHelper.extractIp(req);
    //global rate limit
    const globalCount = await this.redis.getGlobalRateLimit(ip);
    if (Number(globalCount[0]) > Number(MAX_REQUEST_WITHIN_1_MIN)) {
      this.logger.error("Global rate limit broked, cool-off "+globalCount[1].toString(),req);
      res
        .writeHead(429, {
          "retry-after": globalCount[1].toString(),
        })
        .end("rate limit exceeded");
      return false;
    }
    //local rate limit
    if (this.rateLimitToken <= 0) {
      this.logger.warn("Container Rate limit broken",req);
      res.writeHead(429).end("Rate limit broken kindly retry after some time");
      return false;
    }
    this.rateLimitToken--;
    return true;
  }
}
