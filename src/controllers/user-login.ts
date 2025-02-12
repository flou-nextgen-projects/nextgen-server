import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose from "mongoose";
import { pick } from "lodash";
import AppService from "../services/app-service";
import { readFileSync } from "fs";
import { resolve, join } from "path";
import moment from 'moment';
import config from "../configurations";
var jwt = require('jsonwebtoken');
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
        var orgId = user.oid;        
        var license = false;
        let orgMaster = await appService.mongooseConnection.collection("organizationMaster").findOne({ _id: new Mongoose.Types.ObjectId(orgId) });
        try {
            const decodedToken = jwt.verify(orgMaster.genAIToken, config.secretKey);
            let nextGenBody = JSON.parse(atob(orgMaster.genAIToken.split('.')[1]));
            const startDate = moment(nextGenBody.startDate, 'MM-DD-YYYY');
            const futureDate = startDate.clone().add(nextGenBody.days, 'days');
            const isDateValid = futureDate.startOf('day').isSameOrAfter(moment().startOf('day'));
            license = isDateValid ? true : false;
            response.setHeader('Access-Control-Allow-Headers', 'x-token');
            response.setHeader('Access-Control-Expose-Headers', 'x-token');
            response.setHeader('x-token', token);
            user.license = license;
            response.status(200).send(user).end();
            
        } catch (error) {          
            response.status(401).json({ message: "Invalid license token" }).end();
            return;
        }
       
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
    response.status(200).json({ message: "Default roles and users are added successfully" }).end();
});
module.exports = loginRouter;