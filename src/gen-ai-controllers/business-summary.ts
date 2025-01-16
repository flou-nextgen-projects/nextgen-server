import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { ObjectId } from "mongodb";

const bsRouter: Router = Express.Router();
bsRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let businessSummary = request.body;
    collection.insertOne(businessSummary).then((reference) => {
        response.status(200).json((reference)).end();
    }).catch((err) => {
        response.status(500).json({ err }).end();
    });
}).get("/", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let $filter = JSON.parse(<string>request.query.$filter);
    let filter = Object.assign({}, $filter);
    let summary = await collection.findOne(filter);
    if (!summary) {
        return response.status(404).json({ message: 'There is no existing summary generated for this document. Please generate it.' }).end();
    }
    response.status(200).json((summary)).end();
}).get("/all", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let $filter = JSON.parse(<string>request.query.$filter);
    let filter = Object.assign({}, $filter);
    let summary = await collection.find(filter).toArray();
    if (!summary) {
        return response.status(404).json({ message: 'There is no existing data generated for this document. Please generate it.' }).end();
    }
    response.status(200).json((summary)).end();
}).post("/update-by-id/:id", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let data = await collection.findOneAndUpdate(
        { _id: new ObjectId(request.params.id) },
        { $set: request.body },
        { returnDocument: 'after' }
    );
    if (!data) {
        return response.status(404).json({ message: 'business Summary Update API Error' }).end();
    }
    response.status(200).json(({ message: `${data.type} Update Successfully`, data })).end();
});;

module.exports = bsRouter;