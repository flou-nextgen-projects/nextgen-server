import { verify } from 'jsonwebtoken';
import Express, { NextFunction, Request, Response, Router } from 'express';
import config from "../configurations";
import AppService from '../services/app-service';
import moment from 'moment';
const appService: AppService = new AppService();

var genAiToken = "";
const authRouter: Router = Express.Router();
const knownErrors = ['JsonWebTokenError', 'TokenExpiredError'];
// appService.mongooseConnection.collection("organizationMaster").findOne({}).then((res) => { genAiToken = res.nextGenToken; });

authRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    const token = request.headers.authorization?.replace("Bearer ", "").trim();
    if (!token) {
        return response.status(401).json({ message: "Unauthorized" });
    }
    try {
        appService.mongooseConnection.collection("organizationMaster").findOne({}).then((res) => {
            genAiToken = res.nextGenToken;
            verify(genAiToken, config.secretKey);       
            let nextGenBody = JSON.parse(atob(genAiToken.split('.')[1]));
            const startDate = moment(nextGenBody.startDate, 'MM-DD-YYYY');
            const futureDate = startDate.clone().add(nextGenBody.days, 'days');
            const isDateValid = futureDate.startOf('day').isSameOrAfter(moment().startOf('day'));
            if (!isDateValid) {
                response.status(401).json({ code: 401, message: "License expired ", data: { message: "The license keys have expired, please contact your admin for receiving new keys" } });
                return;
            }    
        });    
        const decoded: any = verify(token, config.secretKey);
        request.user = decoded.user;
        next();
    } catch (error) {
        return response.status(401).json({ message: "Unauthorized", details: knownErrors.includes(error.name) ? 'Invalid Token' : 'Authentication failed' }).end();
    }
});
module.exports = authRouter;