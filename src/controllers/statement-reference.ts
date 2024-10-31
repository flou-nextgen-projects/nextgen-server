import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const statementRouter: Router = Express.Router();
import { appService } from "../services/app-service";
statementRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-block", async (request: Request, response: Response, next: NextFunction) => {
    let mid: string = <string>request.query.mid;
    let statements: any[] = await _getBlock(mid);
    response.status(200).json(statements).end();
}).get("/expand-workflow/:fid/:methodNo", async (request: Request, response: Response, next: NextFunction) => {
    let fid: string = <string>request.params.fid;
    let methodNo: number = parseInt(request.params.methodNo);
    let collection = appService.mongooseConnection.collection("statementMaster");
    let statements = await collection.find({ fid: new ObjectId(fid), methodNo, indicators: { $nin: [1001, 1002] } }).toArray();
    if (statements.length === 0) {
        response.status(200).json([]).end();
    }
    let original = statements[0].originalLine;
    let sp: string = original.match(/^[\s]+/gi).shift();
    statements.forEach((d: any) => { d.originalLine = d.originalLine.replace(sp, ""); });
    let expanded: any[] = [];
    for (const statement of statements) {
        if (!statement.references || statement.references.length === 0) {
            expanded.push(statement);
            continue;
        }
        let sps: string = statement.originalLine.match(/^[\s]+/gi).shift();
        await _expandBlock(statement, sps);
    }
    response.status(200).json(statements).end();
});
const _expandBlock = async (callExt: any, sps: string) => {
    const statements: any[] = await _getBlock(callExt.references.shift().memberId);
    let original = statements[0].originalLine;
    let sp: string = original.match(/^[\s]+/gi).shift();
    let s = sps.replace(sp, "");
    statements.forEach((d: any) => { d.originalLine = `${s}${d.originalLine}`; });
    callExt.children = statements;
    for (const statement of callExt.children) {
        if (!statement.references || statement.references.length === 0) {
            continue;
        }
        let sps: string = statement.originalLine.match(/^[\s]+/gi).shift();
        await _expandBlock(statement, sps);
    }
};

const _getBlock = (memberId: string): Promise<Document[]> => new Promise(async (resolve: Function, _: Function) => {
    let collection = appService.mongooseConnection.collection("statementMaster");
    let pipeLine = [
        { $match: { memberId: new ObjectId(memberId) } },
        { $limit: 1 },
        {
            $lookup: {
                from: "statementMaster", let: { fid: "$fid", methodNo: "$methodNo" },
                pipeline: [{
                    $match: {
                        $expr: {
                            $and: [{ $eq: ["$fid", "$$fid"] }, { $eq: ["$methodNo", "$$methodNo"] }, { $not: { $in: [1001, "$indicators"] } }, { $not: { $in: [1002, "$indicators"] } }]
                        }
                    }
                },
                { $lookup: { from: "methodDetails", localField: "methodId", foreignField: "_id", as: "methodDetails" } },
                { $unwind: { path: "$methodDetails", preserveNullAndEmptyArrays: true } },
                { $lookup: { from: "memberReferences", localField: "memberId", foreignField: "_id", as: "memberInfo" } },
                { $unwind: { path: "$memberInfo", preserveNullAndEmptyArrays: true } }], as: "statements"
            }
        },
        { $unwind: "$statements" },
        { $replaceRoot: { newRoot: "$statements" } }
    ];
    let statements: any[] = await collection.aggregate(pipeLine).toArray();
    resolve(statements);
});

module.exports = statementRouter;