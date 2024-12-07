import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const docRouter: Router = Express.Router();
import { appService } from "../services/app-service";
docRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/doc-statements", async (request: Request, response: Response, next: NextFunction) => {
    let did: string = <string>request.query.did;
    let pipeLine = [
        { $match: { fid: new ObjectId(did), indicators: { $nin: [1001, 1002] } } },
        { $lookup: { from: "methodDetails", localField: "methodId", foreignField: "_id", as: "methodDetails" } },
        { $unwind: { path: "$methodDetails", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "memberReferences", localField: "memberId", foreignField: "_id", as: "memberInfo" } },
        { $unwind: { path: "$memberInfo", preserveNullAndEmptyArrays: true } }, { $sort: { lineIndex: 1 } }
    ];
    let statements = await appService.mongooseConnection.collection("statementMaster").aggregate(pipeLine).toArray();
    response.status(200).json(statements).end();
}).get("/source-contents/:did", async (request: Request, response: Response, next: NextFunction) => {
    let did: string = <string>request.params.did;
    let pipeLine = [
        { $match: { fid: new ObjectId(did) } },
        { $lookup: { from: "fileMaster", localField: "fid", foreignField: "_id", as: "fileMaster" } },
        { $unwind: { path: "$fileMaster", preserveNullAndEmptyArrays: true } }
    ];
    let fileContents = await appService.fileContentMaster.aggregate(pipeLine);
    
    if (fileContents.length === 0) return response.status(404).send().end();

    let fcm = fileContents.shift();
    response.status(200).json(fcm).end();
});

module.exports = docRouter;