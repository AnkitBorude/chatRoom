import { TOKENTYPE } from "backend/types";
import jwt from "jsonwebtoken";

export class JWTTokenManager{
    constructor(private env:Record<TOKENTYPE,string>){
    
    }
}