import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const statementRouter: Router = Express.Router();
import { appService } from "../services/app-service";
import { WinstonLogger, ConsoleLogger } from "yogeshs-utilities";
import ProgressBar from "progress";

let winstonLogger: WinstonLogger = new WinstonLogger(__filename);
let consoleLogger: ConsoleLogger = new ConsoleLogger(__filename);

statementRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-block", async (request: Request, response: Response, next: NextFunction) => {
    let mid: string = <string>request.query.mid;
    let statements: any[] = await _getBlock(mid);
    response.status(200).json(statements).end();
}).get("/expand-workflow/:fid/:methodNo", async (request: Request, response: Response, next: NextFunction) => {
    let fid: string = <string>request.params.fid;
    let methodNo: number = parseInt(request.params.methodNo);
    winstonLogger.info("Started execution of expanding workflow.", { extras: { fid, methodNo }, code: "sr-0002", name: "expand-workflow" });
    let collection = appService.mongooseConnection.collection("statementMaster");
    let statements = await collection.find({ fid: new ObjectId(fid), methodNo, indicators: { $nin: [1001, 1002] } }).toArray();
    if (statements.length === 0) {
        response.status(200).json([]).end();
    }
    let original = statements[0].originalLine;
    let sp: string = original.match(/^[\s]+/gi).shift();
    statements.forEach((d: any) => { d.originalLine = d.originalLine.replace(sp, ""); });
    let expanded: any[] = [];
    consoleLogger.log("Expanding call externals...");
    let progress = consoleLogger.showProgress(100);
    let counter = 1;
    for (const statement of statements) {
        if (!statement.references || statement.references.length === 0) {
            expanded.push(statement);
            continue;
        }
        let sps: string = statement.originalLine.match(/^[\s]+/gi).shift();
        progress.tick({ done: counter, length: 100 });
        await _expandBlock(statement, sps, { progress, counter });
    }
    progress.terminate();
    winstonLogger.info(`There were total '${progress.curr}' call/s made to expand this workflow.`);
    response.status(200).json(statements).end();
});
const _expandBlock = async (callExt: any, sps: string, options: { progress: ProgressBar, counter: number }) => {
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
        options.progress.tick({ done: ++options.counter });
        await _expandBlock(statement, sps, options);
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