import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";

const bcRouter: Router = Express.Router();
bcRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", function (request: Request, response: Response) {
    let payload = Array.isArray(request.body) ? request.body : [request.body];
    var res = appService.baseCommandMaster.addItem(payload);
    res.then((reference) => {
        response.status(200).json((reference)).end();
    }).catch((err) => {
        response.status(500).json({ err }).end();
    });
});

module.exports = bcRouter;