import Express, { NextFunction, Request, Response, Router } from "express";
import { appService } from "../services/app-service";
const languageRouter: Router = Express.Router();

languageRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async function (request: Request, response: Response) {
    var languageMasters = await appService.languageMaster.getAllDocuments();
    response.status(200).json(languageMasters).end();
}).post("/", function (request: Request, response: Response) {
    var languageMaster = request.body;
    var promise = appService.languageMaster.addItem(languageMaster);
    promise.then((doc) => {
        response.status(200).json(doc).end();
    }).catch(err => {
        response.status(500).json(err).end();
    });
}).delete("/", function (request: Request, response: Response) {
    var id: string = <string>request.query.id;
    var docQuery = appService.languageMaster.remove(id);
    docQuery.then(res => {
        response.status(200).json(res).end();
    }).catch(err => {
        response.status(500).json(err).end();
    });
}).get("/:id", async function (request: Request, response: Response) {
    var languageId = <string>request.params.id;
    var languageMaster = await appService.languageMaster.getItem({ languageId });
    response.status(200).json(languageMaster).end();
});


module.exports = languageRouter;