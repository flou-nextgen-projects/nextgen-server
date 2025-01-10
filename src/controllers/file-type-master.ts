import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import Mongoose from "mongoose";

const ftmRouter: Router = Express.Router();

ftmRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", (request: Request, response: Response) => {
    var fileTypeMaster = request.body;
    const promise = appService.fileTypeMaster.addItem(fileTypeMaster);
    promise.then(doc => {
        response.status(200).json(doc).end();
    }).catch(err => {
        response.status(500).json({ exception: err }).end();
    });
}).get("/", function (request: Request, response: Response) {
    var promise = appService.fileTypeMaster.getAllDocuments();
    promise.then(docs => {
        response.status(200).json(docs).end();
    }).catch(err => {
        response.status(500).json(err).end();
    });
}).get("/aggregate", function (request: Request, response: Response) {
    var promise = appService.fileTypeMaster.aggregate();
    promise.then(docs => {
        response.status(200).json(docs).end();
    }).catch(err => {
        response.status(500).json(err).end();
    });
}).get("/:lid", function (request: Request, response: Response) {
    let lid: string = request.params.lid;
    var promise = appService.fileTypeMaster.getDocuments({ lid: new Mongoose.Types.ObjectId(lid) }, {}, {}, { fileTypeName: 1 });
    promise.then(docs => {
        response.status(200).json(docs).end();
    }).catch(err => {
        response.status(500).json(err).end();
    });
});

module.exports = ftmRouter;