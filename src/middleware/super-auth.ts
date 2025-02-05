import { verify } from 'jsonwebtoken';
import Express, { NextFunction, Request, Response, Router } from 'express';
import config from "../configurations";
import { UserRoles } from '../models';
import { WinstonLogger } from 'nextgen-utilities';

const winstonLogger: WinstonLogger = new WinstonLogger(__filename);
const superAuthRouter: Router = Express.Router();
const knownErrors = ['JsonWebTokenError', 'TokenExpiredError'];

superAuthRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    const token = request.headers.authorization?.replace("Bearer ", "").trim();
    if (!token) {
        return response.status(401).json({ message: "Unauthorized" });
    }
    try {
        const decoded: any = verify(token, config.secretKey);
        let user = decoded.user;
        let roleName = user.roleMaster.roleName;
        if (![UserRoles.SUPER_ADMIN, UserRoles.SITE_ADMIN].some((d: string) => d === roleName)) {
            return response.status(400).send({ message: "Unauthorized", details: 'You are not allowed to perform this operation.' }).end();
        }
        winstonLogger.info(`User ${user._id} with Role: ${user.roleMaster.roleName} did activity on endpoint ${request.url}`, { name: user.roleMaster.roleName, code: "info-4000", extras: { date: new Date() } });
        request.user = user;
        next();
    } catch (error) {
        return response.status(401).json({ message: "Unauthorized", details: knownErrors.includes(error.name) ? 'Invalid Token' : 'Authentication failed' }).end();
    }
});

module.exports = superAuthRouter;