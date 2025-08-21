import { TOKENTYPE } from "backend/types";
import jwt from "jsonwebtoken";
import http from "http";
export class JWTTokenManager {
  constructor(private env: Record<TOKENTYPE, string>) {}

  public isAuthenticated(req: http.IncomingMessage): boolean {
    const header = req.headers["authorization"];
    if (!header) return false;
    const [, token] = header.split(" ");
    try {
      jwt.verify(token, this.env.JWT_SECRET);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  public signToken(username: string, serverId: string) {
    const token = jwt.sign({ user: username, serverId }, this.env.JWT_SECRET, {
      expiresIn: "30m",
    });
    return token;
  }
}
