import { verify } from 'jsonwebtoken';
import Express, { NextFunction, Request, Response, Router } from 'express';
import config from "../configurations";

const authRouter: Router = Express.Router();
authRouter.use("/", (request: Request | any, response: Response, next: NextFunction) => {
    const authHeader = request.header('authorization');

    if (!authHeader) {
        return response.status(401).send({ message: "Unauthorized", details: 'Authorization header was not sent' }).end();
    }

    var token = request.headers.authorization.replace("Bearer ", "").trim();

    if (!token) {
        return response.status(401).send({ message: "Unauthorized", details: 'Invalid or no token used' }).end();
    }

    try {
        const decoded = verify(token, config.secretKey);
        request.user = decoded;
        next();
    } catch (error) {
        if (["JsonWebTokenError", "TokenExpiredError"].includes(error.name)) {
            return response.status(401).send({ message: "Unauthorized", details: 'Token expired' }).end();
        }
        return response.status(400).send({ message: "Unauthorized", details: 'Token expired' }).end();
    }
});

module.exports = authRouter;