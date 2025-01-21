import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose from "mongoose";
const roleMasterRouter: Router = Express.Router();
import AppService from "../services/app-service";

const appService: AppService = new AppService();
roleMasterRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post('/', function (request: Request, response: Response) {
    var role = request.body;
    appService.roleMaster.addItem(role).then((result) => {
        response.status(200).send(result).end();
    }, (err: Mongoose.Error) => {
        response.status(500).json({ message: err.message, exception: err }).end();
    });
}).get('/', function (request: Request, response: Response) {
    let $filter = JSON.parse(<string>request.query.filter || "{}");
    appService.roleMaster.getDocuments($filter).then((result) => {
        response.status(200).send(result).end();
    }, (err: Mongoose.Error) => {
        response.status(500).json({ message: err.message, exception: err }).end();
    });
});
module.exports = roleMasterRouter;
