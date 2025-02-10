import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose from "mongoose";
import { pick } from "lodash";
import AppService from "../services/app-service";
import { readFileSync } from "fs";
import { resolve, join } from "path";

const appService: AppService = new AppService();
const loginRouter: Router = Express.Router();

loginRouter.use("/", (_: Request, __: Response, next: NextFunction) => {
    next();
}).post("/login", function (request: Request, response: Response) {
    var body = pick(request.body, ['userName', 'password']);
    var UserMaster: any = appService.userMaster.getModel();
    UserMaster.findByCredentials(body.userName, body.password).then(async function (user: any) {
        var token = UserMaster.generateAuthTokenOne(user);
        await appService.userMaster.updateDocument({ _id: user._id }, { lastLogin: new Date() });
        response.setHeader('Access-Control-Allow-Headers', 'x-token');
        response.setHeader('Access-Control-Expose-Headers', 'x-token');
        response.setHeader('x-token', token);
        response.send().end();
    }).catch(function (ex: Mongoose.Error) {
        response.status(404).json({ exception: ex });
    });
}).get("/id/:uid/:tid", function (request: Request, response: Response) {
    let uid: string = request.params.uid;
    let tid: string = request.params.tid;
    var UserMaster: any = appService.userMaster.getModel();
    UserMaster.findByObjectId(uid, tid).then(async function (user: any) {
        var token = UserMaster.generateAuthTokenOne(user);
        await appService.userMaster.updateDocument({ _id: user._id }, { lastLogin: new Date() });
        response.setHeader('Access-Control-Allow-Headers', 'x-token');
        response.setHeader('Access-Control-Expose-Headers', 'x-token');
        response.setHeader('x-token', token);
        response.send().end();
    }).catch(function (ex: Mongoose.Error) {
        response.status(404).json({ exception: ex });
    });
}).get("/add-default-roles-and-users", async function (request: Request, response: Response) {
    const configPath = resolve(join(__dirname, "../", "db", "init-db.json"));
    const configData = readFileSync(configPath).toString();
    const configJson: any[] = JSON.parse(configData) || [];
    let roleMaster = configJson.find((d) => d.collection === "roleMaster").documents;
    await appService.roleMaster.bulkInsert(roleMaster);
    let userMaster = configJson.find((d) => d.collection === "userMaster").documents;
    await appService.userMaster.bulkInsert(userMaster);
    response.status(200).json({message: "Default roles and users are added successfully"}).end();
});
module.exports = loginRouter;