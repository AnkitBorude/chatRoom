import http from "http";
import { RedisClientWrapper } from "./redis/redis.client";
import { ChatRoomWebsocket } from "./chatroom.websocket";
import { RedisClientType } from "redis";

const server = http.createServer(healthCheck);

const redisCommandClient: RedisClientWrapper = new RedisClientWrapper(
  "redis-command-client",
);
const redisSubscriber: RedisClientWrapper = new RedisClientWrapper(
  "redis-subscriber",
);
function healthCheck(
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage>,
) {
  if (req.method === "GET" && req.url === "/health") {
    const healthcheck = {
      uptime: process.uptime(),
      message: "OK",
      timestamp: Date.now(),
    };

    try {
      res.writeHead(200, {
        "content-type": "text/json",
      });
      res.end(JSON.stringify(healthcheck));
    } catch (error) {
      res.statusCode = 503;
      healthcheck.message = error as string;
      res.end(JSON.stringify(healthcheck));
    }
  }
}

server.listen(3000, async () => {
  console.log("Server listening on 3000");
  const clients = await connectRedisClients();
  const chatroomSocket = new ChatRoomWebsocket(
    server,
    clients.commandClient,
    clients.subscriberClient,
  );
  await chatroomSocket.initialize();
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
