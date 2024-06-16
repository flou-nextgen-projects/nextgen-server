import { verify } from 'jsonwebtoken';
import { Request, Response } from 'express';
import config from "../configurations";

const clientAuth = function (request: Request | any, response: Response, next: Function) {
    try {
        var token = request.headers.authorization.replace("Bearer ", "");
        var decoded: any = verify(token, config.secretKey);
        request.userId = request.userId || {};
        request.user = decoded.user;
        next();
    } catch (error: any) {
        response.status(401).json({ message: "Unauthorized" });
    }
}

export default clientAuth;