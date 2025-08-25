import http from "http";
import { RedisClientWrapper } from "./redis/redis.client";
import { ChatRoomWebsocket } from "./chatroom.websocket";
import { RedisClientType } from "redis";

const server = http.createServer(requestHandler);
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

  console.log(formatMorganStyleLog(req));
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    const healthcheck = {
      uptime: process.uptime(),
      message: "OK",
      timestamp: Date.now(),
    };

    try {
      console.log("Health Check");
      res.writeHead(200,{ "Content-Type": "application/json" }).end(JSON.stringify(healthcheck));
    } catch (error) {
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
      res.writeHead(404).end("Server does not have admin access configured");
      return;
    }
    return;
  }

  // Catch-all 404
  res.writeHead(404).end("Route not found");
  return;
}
server.listen(3000, async () => {
  console.log("Server listening on 3000");
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
  console.log("Cannot connect to redis error");
  process.exit(0);
}

async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Stop accepting new requests
  if (server) {
    server.close(async () => {
      console.log("HTTP server closed");

      try {
        // Close all active connections
        await chatRoomInstance.closeSocket();
        // Close Redis connection

        await redisCommandClient.closeClient();
        await redisSubscriber.closeClient();
        console.log("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      console.error("Force shutdown after timeout");
      process.exit(1);
    }, 30000); // 30 seconds timeout
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));


function formatMorganStyleLog(req: http.IncomingMessage): string {
    const method = req.method || 'UNKNOWN';
    const url = req.url || '/';
    const remoteAddress = req.socket.remoteAddress || 'UNKNOWN';
    const userAgent = req.headers['user-agent'] || '-';

    // Example format: ":remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent""
    // Simplified for this example
    return `${remoteAddress} - - [${new Date().toUTCString()}] "${method} ${url} HTTP/${req.httpVersion}"-" "${userAgent}"`;
}