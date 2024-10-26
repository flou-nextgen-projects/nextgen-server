import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const statementRouter: Router = Express.Router();
import { appService } from "../services/app-service";
statementRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-block", async (request: Request, response: Response, next: NextFunction) => {
    let mid: string = <string>request.query.mid;
    let collection = appService.mongooseConnection.collection("StatementReference");
    let member = await collection.findOne({ memberId: new ObjectId(mid) });
    let did: string = member.docId;
    let methodNo: number = member.methodNo;
    let pipeLine = [
        { $match: { docId: new ObjectId(did), methodNo, indicators: { $nin: [1001, 1002] } } },
        { $lookup: { from: "MethodDetails", localField: "methodId", foreignField: "_id", as: "methodDetails" } },
        { $unwind: { path: "$methodDetails", preserveNullAndEmptyArrays: true } },
        // { $lookup: { from: "MemberReferences", localField: "callingTo.methodId", foreignField: "_id", as: "callingTo.memberInfo" } },
        { $lookup: { from: "MemberReferences", localField: "memberId", foreignField: "_id", as: "memberInfo" } },
        { $unwind: { path: "$memberInfo", preserveNullAndEmptyArrays: true } }
    ];
    let statements: any[] = await collection.aggregate(pipeLine).toArray();
    response.json(statements).end();
});

module.exports = statementRouter;