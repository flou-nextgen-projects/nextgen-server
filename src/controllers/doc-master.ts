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
        { $unwind: { path: "$memberInfo", preserveNullAndEmptyArrays: true } }, { $sort: { location: 1 } }
    ];
    let statements = await appService.mongooseConnection.collection("statementMaster").aggregate(pipeLine).toArray();
    response.status(200).json(statements).end();
}).get("/source-contents/:mid", async (request: Request, response: Response, next: NextFunction) => {
    let mid: string = <string>request.params.mid;
    let fileContents: any = await appService.fileContentMaster.getItem({ methodId: new ObjectId(mid) });
    let originalLines = "";
    if (!fileContents) {
        fileContents = await appService.methodStatementsMaster.getDocuments({ methodId: new ObjectId(mid) })
        if (Array.isArray(fileContents) && fileContents.length > 0) {
            originalLines = fileContents
                .map((item: any) => item.originalLine || item.modifiedLine || "")
                .join("\n");
        }
        fileContents = {
            original: originalLines
        };
    }
    response.status(200).json(fileContents).end();
});

module.exports = docRouter;