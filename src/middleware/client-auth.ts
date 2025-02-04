import { verify } from 'jsonwebtoken';
import Express, { NextFunction, Request, Response, Router } from 'express';
import config from "../configurations";

const authRouter: Router = Express.Router();
const knownErrors = ['JsonWebTokenError', 'TokenExpiredError'];
authRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    const token = request.headers.authorization?.replace("Bearer ", "").trim();
    if (!token) {
        return response.status(401).json({ message: "Unauthorized"});
    }
    try {
        const decoded: any = verify(token, config.secretKey);                
        request.user = decoded.user;
        next();
    } catch (error) {
        return response.status(401).json({ message: "Unauthorized", details: knownErrors.includes(error.name) ? 'Invalid Token' : 'Authentication failed' }).end();
    }
});

module.exports = authRouter;