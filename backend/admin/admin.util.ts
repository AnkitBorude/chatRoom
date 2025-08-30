import http from "http";
import winston from "winston";
export class AdminHelperUtility {
  private _logger;

  constructor() {
    this._logger = winston.createLogger({
      transports: [new winston.transports.Console()],
      format: winston.format.combine(
        winston.format.json(),
        winston.format.timestamp(),
        winston.format.label({ label: "Admin" }),
      ),
    });
  }

  public getBody(req: http.IncomingMessage): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      let data = "";

      req.on("data", (chunk) => {
        data += chunk;
        if (data.length > 64) {
          req.destroy();
          return reject("413");
        }
      });

      req.on("end", () => {
        try {
          resolve(JSON.parse(data || "{}"));
        } catch {
          reject("400");
        }
      });
    });
  }

  public extractIp(req: http.IncomingMessage): string {
    const ip = req.headers["x-real-ip"];
    if (ip) {
      //accept first duplicate header value only fallabck to 0.0.0.0
      return ip[0] || "0.0.0.0";
    } else {
      return req.socket.remoteAddress || "0.0.0.0";
    }
  }

  public getLogger() {
    return {
      warn: (message: string, req: http.IncomingMessage) => {
        this._logger.warn(req.url + " " + message, { ip: this.extractIp(req) });
      },
      error: (message: string, req: http.IncomingMessage) => {
        this._logger.error(req.url + " " + message, {
          ip: this.extractIp(req),
        });
      },
      info: (message: string, req: http.IncomingMessage) => {
        this._logger.warn(req.url + " " + message, { ip: this.extractIp(req) });
      },
    };
  }
}
