import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const statementRouter: Router = Express.Router();
import { appService } from "../services/app-service";
import { WinstonLogger, ConsoleLogger } from "nextgen-utilities";
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
    let member = await appService.memberReferences.getItem({ _id: new ObjectId(fid) });
    let methodNo: number = parseInt(request.params.methodNo);
    winstonLogger.info("Started execution of expanding workflow.", { extras: { fid, methodNo }, code: "sr-0002", name: "expand-workflow" });
    let collection = appService.mongooseConnection.collection("statementMaster");
    let statements = await collection.find({ fid: member.fid, methodNo, indicators: { $nin: [1001, 1002] } }, { sort: { _id: 1 } }).toArray();
    if (statements.length === 0) {
        response.status(200).json([]).end();
    }
    let original = statements[0].originalLine;
    let sp: string = original.match(/^[\s]+/gi)?.shift() || "";
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
        let sps: string = statement.originalLine.match(/^[\s]+/gi)?.shift() || " ";
        progress.tick({ done: counter, length: 100 });
        await _expandBlock(statement, sps, { progress, counter, expanded: [] });
    }
    progress.terminate();
    winstonLogger.info(`There were total '${progress.curr}' call/s made to expand this workflow.`);
    // statements array is actually the expanded array in which each element has children array of statements.
    // we need to take all the children and push them to the expanded array at root of the array.
    // we need a utility type function which we can call recursively to flatten the array.
    var flatten = function (statements: any[], result: any[] = []): any[] {
        for (var i = 0; i < statements.length; i++) {
            var statement = statements[i];
            if (statement.children && statement.children.length > 0) {
                flatten(statement.children, result);
            } else {
                result.push(statement);
            }
        }
        return result;
    };
    var flatStatements = flatten(statements);
    // now concatenate the expanded array to the flat statements array.
    let formatted = flatStatements.map((d: any) => {
        let originalLine = d.originalLine.replace(/^[\s]+/gi, "");
        return originalLine;
    }).join("\n");
    response.status(200).json({ formatted }).end();
});
const _expandBlock = async (callExt: any, sps: string, options: { progress: ProgressBar, counter: number, expanded: Array<string> }) => {
    const statements: any[] = await _getBlock(callExt.references.shift().memberId);
    let method = statements.find((d) => d.indicators.includes(5) && d.methodId);
    let methodId = method._id.toString();
    if (options.expanded.includes(methodId)) return;
    options.expanded.push(methodId);
    let original = statements[0].originalLine;
    let sp: string = original.match(/^[\s]+/gi).shift();
    let s = sps.replace(sp, "");
    statements.forEach((d: any) => { d.originalLine = `${s}${d.originalLine}`; });
    callExt.children = statements;
    for (const statement of callExt.children) {
        if (!statement.references || statement.references.length === 0) continue;
        let sps: string = statement.originalLine.match(/^[\s]+/gi)?.shift() || " ";
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
        { $replaceRoot: { newRoot: "$statements" } },
        { $sort: { _id: 1 } }
    ];
    let statements: any[] = await collection.aggregate(pipeLine).toArray();
    resolve(statements);
});

module.exports = statementRouter;