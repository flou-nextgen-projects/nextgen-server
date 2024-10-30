import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const statementRouter: Router = Express.Router();
import { appService } from "../services/app-service";
statementRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-block", async (request: Request, response: Response, next: NextFunction) => {
    let mid: string = <string>request.query.mid;
    let collection = appService.mongooseConnection.collection("statementMaster");
    let member = await collection.findOne({ memberId: new ObjectId(mid) });
    let did: string = member.fid;
    let methodNo: number = member.methodNo;
    let pipeLine = [
        { $match: { fid: new ObjectId(did), methodNo, indicators: { $nin: [1001, 1002] } } },
        { $lookup: { from: "methodDetails", localField: "methodId", foreignField: "_id", as: "methodDetails" } },
        { $unwind: { path: "$methodDetails", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "memberReferences", localField: "memberId", foreignField: "_id", as: "memberInfo" } },
        { $unwind: { path: "$memberInfo", preserveNullAndEmptyArrays: true } }
    ];
    let statements: any[] = await collection.aggregate(pipeLine).toArray();
    response.status(200).json(statements).end();
});

module.exports = statementRouter;