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
        { $unwind: { path: "$memberInfo", preserveNullAndEmptyArrays: true } }
    ];
    let statements = await appService.mongooseConnection.collection("statementMaster").aggregate(pipeLine).toArray();
    response.json(statements).end();
});

module.exports = docRouter;