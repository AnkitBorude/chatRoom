import http from "http";
import { RedisClientWrapper } from "./redis/redis.client";
import { ChatRoomWebsocket } from "./chatroom.websocket";
import { RedisClientType } from "redis";
import winston from "winston";
const server = http.createServer(requestHandler);

const logger=winston.createLogger(
  {
    level:'http',
    transports:[
      new winston.transports.Console()
    ],
    format:winston.format.combine(
      winston.format.json(),
      winston.format.label({label:'HTTP'}),
      winston.format.timestamp(),
    )
  }
);


let chatRoomInstance: ChatRoomWebsocket;
const redisCommandClient: RedisClientWrapper = new RedisClientWrapper(
  "redis-command-client",
);
const redisSubscriber: RedisClientWrapper = new RedisClientWrapper(
  "redis-subscriber",
);

function requestHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage>,
) {
  logger.http(formatMorganStyleLog(req));
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    const healthcheck = {
      uptime: process.uptime(),
      message: "OK",
      timestamp: Date.now(),
    };

    try {
      console.log("Health Check by container");
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(healthcheck));
    } catch (error) {
      logger.error("Error in healthcheck");
      res.statusCode = 503;
      res.end(
        JSON.stringify({
          uptime: process.uptime(),
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        }),
      );
    }
    return;
  }

  // 🔒 Placeholder: If you have AdminController, you can check here
  if (req.url?.startsWith("/admin")) {
    
    if (!chatRoomInstance.hasAdminAccess) {
      logger.warn("Access not configured to "+req.url);
      res.writeHead(404).end("Server does not have admin access configured");
      return;
    }
    return;
  }

  // Catch-all 404
  res.writeHead(404).end("Route not found");
  logger.warn("Route not found "+req.url);
  return;
}
server.listen(3000, async () => {
  logger.info("Server listening on 3000");
  const clients = await connectRedisClients();
  chatRoomInstance = new ChatRoomWebsocket(
    server,
    clients.commandClient,
    clients.subscriberClient,
  );
  await chatRoomInstance.initialize();
});

async function connectRedisClients(): Promise<{
  commandClient: RedisClientType;
  subscriberClient: RedisClientType;
}> {
  const commandClient = await redisCommandClient.connect();
  const subscriberClient = await redisSubscriber.connect();
  if (commandClient && subscriberClient) {
    return { commandClient, subscriberClient };
  }
  logger.error("Cannot connect to redis error");
  process.exit(0);
}

async function gracefulShutdown(signal: string) {
  logger.warn(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Stop accepting new requests
  if (server) {
    server.close(async () => {
      logger.info(" Server Close event : HTTP server closed");

      try {
        // Close all active connections
        logger.warn("Closing all chatroom and notifying users and sideeffect cleanup");
        await chatRoomInstance.closeSocket();
        // Close Redis connection

        await redisCommandClient.closeClient();
        await redisSubscriber.closeClient();
        logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown");
        logger.error(JSON.stringify(error));
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error("Force shutdown after timeout");
      process.exit(1);
    }, 30000); // 30 seconds timeout
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

function formatMorganStyleLog(req: http.IncomingMessage): string {
  const method = req.method || "UNKNOWN";
  const url = req.url || "/";
  const remoteAddress = req.socket.remoteAddress || "UNKNOWN";
  const userAgent = req.headers["user-agent"] || "-";

  // Example format: ":remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent""
  // Simplified for this example
  return `${remoteAddress} - - [${new Date().toUTCString()}] "${method} ${url} HTTP/${req.httpVersion}"-" "${userAgent}"`;
}
