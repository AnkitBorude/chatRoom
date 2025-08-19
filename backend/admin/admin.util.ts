import http from "http";
export class AdminHelperUtility {
  constructor() {}

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
}
