/*
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

export { clientAuth };
*/

import { verify } from 'jsonwebtoken';
import Express, { NextFunction, Request, Response, Router } from 'express';
import config from "../configurations";

const authRouter: Router = Express.Router();
authRouter.use("/", (request: Request | any, response: Response, next: NextFunction) => {
    const authHeader = request.header('authorization');

    if (!authHeader) {
        return response.status(401).send({ message: "Unauthorized" }).end();
    }

    var token = request.headers.authorization.replace("Bearer ", "").trim();

    if (!token) {
        return response.status(401).send({ message: "Unauthorized" }).end();
    }

    try {
        const decoded = verify(token, config.secretKey);
        request.user = decoded;
        next();
    } catch (error) {
        return response.status(400).send({ message: "Unauthorized" }).end();
    }
});

module.exports = authRouter;