import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const dashBoardRouter: Router = Express.Router();
import { appService } from "../services/app-service";
dashBoardRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-systems/:pid", async (request: Request, response: Response, next: NextFunction) => {
    var pid = request.params.pid;
    let project = await appService.workspaceMaster.getItem({ _id: new ObjectId(pid) });
    if (!project) return response.status(200).json([]).end();
    appService.fileTypeMaster.getDocuments({ lid: project.lid }).then((fileTypes) => {
        response.status(200).json(fileTypes).end();
    }).catch((exp) => {
        response.status(500).json(exp).end();
    });
}).get("/get-workflows", async (request: Request, response: Response) => {
    let $filter: string = <string>request.query.$filter;
    let { fileTypeId, wid, keyword }: { fileTypeId: string, wid: string, keyword: string } = JSON.parse($filter);
    if (!fileTypeId) {
        const query: any = { wid: new ObjectId(wid) };
        if (keyword && keyword.trim()) {
            query.methodName = { $regex: keyword, $options: "i" };
        }
        appService.actionWorkflows.getDocuments(query).then((workflows) => {
            response.status(200).json(workflows).end();
        }).catch((e) => {
            response.status(500).json(e).end();
        });
    } else {
        appService.fileMaster.getDocuments({ fileTypeId: new ObjectId(fileTypeId), wid: new ObjectId(wid) }).then((workflows) => {
            response.status(200).json(workflows).end();
        }).catch((e) => {
            response.status(500).json(e).end();
        });
    }
}).get("/get-workflows", async (request: Request, response: Response) => {
    let $filter: string = <string>request.query.$filter;
    let { fileTypeId, pid }: { fileTypeId: string, pid: string } = JSON.parse($filter);
    appService.fileMaster.getDocuments({ fileTypeId: new ObjectId(fileTypeId), pid: new ObjectId(pid) }).then((workflows) => {
        response.status(200).json(workflows).end();
    }).catch((e) => {
        response.status(500).json(e).end();
    });
}).get("/get-dashboard-tickers", async (request: Request, response: Response) => {
    var wid = <string>request.query.wid;
    const pipeLine = [
        { $match: { wid: new ObjectId(wid) } },
        { $group: { _id: "$fileTypeId", totalLineCount: { $sum: "$linesCount" }, totalCommentedLines: { $sum: "$fileStatics.commentedLines" }, fileCount: { $sum: 1 } } },
        { $lookup: { from: "fileTypeMaster", localField: "_id", foreignField: "_id", as: "fileTypeMaster" } },
        { $unwind: { path: "$fileTypeMaster", preserveNullAndEmptyArrays: true } },
        { $project: { fileTypeId: "$_id", totalLineCount: 1, totalCommentedLines: 1, fileCount: 1, color: "$fileTypeMaster.color", fileTypeName: "$fileTypeMaster.fileTypeName" } },
        { $match: { _id: { $ne: null } as any } }
    ];
    var workflows = await appService.mongooseConnection.collection("actionWorkflows").countDocuments({ wid: new ObjectId(wid) });
    appService.mongooseConnection.collection("fileMaster").aggregate(pipeLine).toArray().then((data: any) => {
        response.status(200).json({ data, workflows }).end();
    }).catch((e) => {
        response.status(500).json(e).end();
    });
}).get("/get-prompts", (request: Request, response: Response) => {
    appService.mongooseConnection.collection("promptConfig").find().toArray().then((data: any) => {
        response.status(200).json(data).end();
    }).catch((err: Error) => {
        response.status(500).json(err).end();
    });
}).get("/get-missing-objects", (request: Request, response: Response) => {
    let wid = <string>request.query.wid;
    appService.mongooseConnection.collection("missingObjects").find({ wid: new ObjectId(wid) }).toArray().then((data: any) => {
        response.status(200).json(data).end();
    }).catch(() => {
        response.status(500).send().end();
    });
});

module.exports = dashBoardRouter;