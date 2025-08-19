import http from 'http';
import { JWTTokenManager } from './jwt.util';
import { TOKENTYPE } from 'backend/types';
import { AdminHelperUtility } from './admin.util';

export class AdminController{

    private serverId:string="";
    private static REQUIRED_ENV_VARIABLES=[
        'ADMIN_USER',
        'ADMIN_PASS',
        'JWT_SECRET'
    ];
    private static environment:Record<TOKENTYPE,string>;

    private tokenManager:JWTTokenManager;
    private adminHelper:AdminHelperUtility;
    private constructor(private server:http.Server){
        this.tokenManager=new JWTTokenManager(AdminController.environment);
        this.adminHelper=new AdminHelperUtility();
    }
    static getInstance(server:http.Server):AdminController | undefined
    {

        Object.keys(TOKENTYPE).forEach((variable)=>{
            if(!process.env[variable])
            {
                console.log("enviroment variable "+variable+" Not found thus restricted admin control");
                return undefined;
            }
            this.environment[variable as TOKENTYPE]=process.env[variable];
        });
        Object.freeze(this.environment);

        return new AdminController(server);
    }

    public startListening(serverId:string)
    {
        this.serverId=serverId;
        this.server.on('request',(req,res)=>{
        
        if (req.url === "/admin/login" && req.method === "POST") {
        return this.loginAdmin(req, res);
      }

      if (req.url === "/admin/servers" && req.method === "GET") {
        return this.getServers(req, res);
      }

      if (req.url === "/admin/rooms" && req.method === "GET") {
        return this.getRooms(req, res);
      }

      if (req.url === "/admin/clients" && req.method === "GET") {
        return this.getClients(req, res);
      }

      // DELETE /admin/client/:id
      if (req.url?.startsWith("/admin/client/") && req.method === "DELETE") {
        const id = parseInt(req.url.split("/").pop()!);
        return this.deleteClient(req, res, id);
      }

      // DELETE /admin/room/:id
      if (req.url?.startsWith("/admin/room/") && req.method === "DELETE") {
        const id = parseInt(req.url.split("/").pop()!);
        return this.deleteRoom(req, res, id);
      }

      // GET /admin/room/:id
      if (req.url?.startsWith("/admin/room/") && req.method === "GET") {
        const id = parseInt(req.url.split("/").pop()!);
        return this.getRoom(req, res, id);
      }

      // GET /admin/client/:id
      if (req.url?.startsWith("/admin/client/") && req.method === "GET") {
        const id = parseInt(req.url.split("/").pop()!);
        return this.getClient(req, res, id);
      }

      // if any request other than this just ignore
      return;
        });
    }

   private async loginAdmin(req: http.IncomingMessage, res: http.ServerResponse) {
    let body;
  try {
    body = await this.adminHelper.getBody(req);
  } catch (err) {
        if(String(err)==="413")
        {
    // payload was too large or invalid JSON
    res.writeHead(413).end("payload was too large ");
    return;
    }
      res.writeHead(400).end("invalid JSON");
    return;
  }

    if (
      body.username === AdminController.environment.ADMIN_USER &&
      body.password === AdminController.environment.ADMIN_PASS
    ) {
      const token = this.tokenManager.signToken(body.username,this.serverId);
      return res.end(JSON.stringify({ token }));
    }
    res.writeHead(401).end("invalid credentials");
  }
    
    
}