import http from 'http';
import { JWTTokenManager } from './jwt.util';
import { TOKENTYPE } from 'backend/types';

export class AdminController{

    private static REQUIRED_ENV_VARIABLES=[
        'ADMIN_USER',
        'ADMIN_PASS',
        'JWT_SECRET'
    ];
    private static environment:Record<TOKENTYPE,string>;

    private tokenManager:JWTTokenManager;
    private constructor(private server:http.Server){
        this.tokenManager=new JWTTokenManager(AdminController.environment);
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
    
}