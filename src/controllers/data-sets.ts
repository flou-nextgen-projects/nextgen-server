import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { WinstonLogger } from "nextgen-utilities";

const dataSetsRouter: Router = Express.Router();
const winstonLogger: WinstonLogger = new WinstonLogger(__filename);

dataSetsRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async (request: Request, response: Response) => {
    let collections = <any>request.query.collection;
    let s = collections.map(function (c: string) { return { collection: c } });
    appService.dataSets(s).then((res) => {
        response.status(200).json(res).end();
    }).catch((err) => {
        winstonLogger.error(err, { name: "Error in data-set endpoint", code: "DATA_SET_ENDPOINT" });
    });
});

module.exports = dataSetsRouter;