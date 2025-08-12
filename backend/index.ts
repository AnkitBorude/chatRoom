import http from "http";
import { RedisClient } from "./redis/redis.client";

const server = http.createServer(healthCheck);

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
const redisClient = new RedisClient();

server.listen(3000, async () => {
  console.log("Server listening on 3000");
  await redisClient.connect();
});
