import { TOKENTYPE } from "backend/types";
import jwt from "jsonwebtoken";
import http from "http";
import { AdminHelperUtility } from "./admin.util";
export class JWTTokenManager {
  private logger;
  constructor(private env: Record<TOKENTYPE, string>,private adminHelper:AdminHelperUtility) {
    this.logger=adminHelper.getLogger();
  }

  public isAuthenticated(req: http.IncomingMessage): boolean {
    const header = req.headers["authorization"];
    if (!header) return false;
    const [, token] = header.split(" ");
    try {
      jwt.verify(token, this.env.JWT_SECRET);
      return true;
    } catch (error) {

      this.logger.error("Token Error "+(error as Error).message,req);
      console.error(error)
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
