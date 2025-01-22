import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose from "mongoose";
import { pick } from "lodash";
import AppService from "../services/app-service";

const appService: AppService = new AppService();
const loginRouter: Router = Express.Router();

loginRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/login", function (request: Request, response: Response) {
    var body = pick(request.body, ['userName', 'password']);
    var UserMaster: any = appService.userMaster.getModel();
    UserMaster.findByCredentials(body.userName, body.password).then(async function (user: any) {
        var token = UserMaster.generateAuthTokenOne(user);
        await appService.userMaster.updateDocument({ _id: user._id }, { lastLoggedInDate: new Date() });
        response.setHeader('Access-Control-Allow-Headers', 'x-token');
        response.setHeader('Access-Control-Expose-Headers', 'x-token');
        response.setHeader('x-token', token);
        response.send().end();
    }).catch(function (ex: Mongoose.Error) {
        response.status(404).json({ exception: ex });
    });
});
module.exports = loginRouter;