import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const dashBoardRouter: Router = Express.Router();
import { appService } from "../services/app-service";
import { MissingObjects } from "src/models";
dashBoardRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    try {
        next();
    } catch (error) {
        console.log(error);
    }
}).get("/get-systems/:pid", async (request: Request, response: Response, next: NextFunction) => {
    var pid = request.params.pid;
    let project = await appService.projectMaster.getItem({ _id: new ObjectId(pid) });
    if (!project) return response.status(200).json([]).end();
    appService.fileTypeMaster.getDocuments({ lid: project.lid }).then((fileTypes) => {
        response.status(200).json(fileTypes).end();
    }).catch((exp) => {
        response.status(500).json(exp).end();
    });
}).get("/get-workflows", async (request: Request, response: Response) => {
    let $filter: string = <string>request.query.$filter;
    let { fileTypeId, pid }: { fileTypeId: string, pid: string } = JSON.parse($filter);
    appService.fileMaster.getDocuments({ fileTypeId: new ObjectId(fileTypeId), pid: new ObjectId(pid) }).then((workflows) => {
        response.status(200).json(workflows).end();
    }).catch((e) => {
        response.status(500).json(e).end();
    });
}).get("/get-dashboard-tickers", (request: Request, response: Response) => {
    var pid = <string>request.query.pid;
    var pipeLine = [
        { $match: { pid: new ObjectId(pid) } },
        { $group: { _id: "$fileTypeId", totalLineCount: { $sum: "$linesCount" }, fileCount: { $sum: 1 } } },
        { $lookup: { from: "fileTypeMaster", localField: "_id", foreignField: "_id", as: "fileTypeMaster" } },
        { $unwind: { path: "$fileTypeMaster", preserveNullAndEmptyArrays: true } },
        { $project: { fileTypeid: "$_id", totalLineCount: 1, fileCount: 1, color: "$fileTypeMaster.color", fileTypeName: "$fileTypeMaster.fileTypeName" } }
    ];
    appService.mongooseConnection.collection("fileMaster").aggregate(pipeLine).toArray().then((data: any) => {
        response.status(200).json(data).end();
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
    let pid = <string>request.query.pid;
    let wid = <string>request.query.wid;   
    // var memberReferences = appService.memberReferences.getDocuments({ wid: new ObjectId(wid) });
    // var missingObjects : MissingObjects =  [];
    appService.mongooseConnection.collection("missingObjects").find({ pid: new ObjectId(pid), isFound: false }).toArray().then((data: any) => {
        /*
        for(const m in data){           
            let memberReference = memberReferences.find((d) => d.callExternals.fid.toString() === m.fi);           
        }
        */
        response.status(200).json(data).end();
    }).catch(() => {
        response.status(500).send().end();
    });
});

module.exports = dashBoardRouter;