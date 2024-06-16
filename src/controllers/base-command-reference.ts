import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";

const bcRefRouter: Router = Express.Router();
bcRefRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", function (request: Request, response: Response) {
    let payload = Array.isArray(request.body) ? request.body : [request.body];
    var res = appService.baseCommandReference.addItem(payload);
    res.then((reference) => {
        response.status(200).json((reference)).end();
    }).catch((err) => {
        response.status(500).json({ err }).end();
    });
}).post("/aggregate", function (request: Request, response: Response) {
    var res = appService.baseCommandReference.aggregate();
    res.then((reference) => {
        response.status(200).json((reference)).end();
    }).catch((err) => {
        response.status(500).json({ err }).end();
    });
});

module.exports = bcRefRouter;