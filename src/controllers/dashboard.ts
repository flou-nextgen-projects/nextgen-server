import Express, { Request, Response, Router, NextFunction } from "express";
import { ObjectId } from "mongodb";
const dashBoardRouter: Router = Express.Router();
import { appService } from "../services/app-service";
dashBoardRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-systems", async (request: Request, response: Response, next: NextFunction) => {
    var projectId = "6752e151c14a4fb7df4c5d91"
    var project = await appService.projectMaster.getItem({ _id: new ObjectId(projectId) });
    appService.fileTypeMaster.getDocuments({ lid: project.lid }).then((fileTypes) => {
        response.status(200).json(fileTypes).end();
    }).catch((exp) => {
        response.status(500).json(exp).end();
    });
}).get("/get-workflows", async (request: Request, response: Response) => {
    var filter: any = request.query;
    var filter1: any = JSON.parse(filter.$filter);
    appService.fileMaster.getDocuments({ fileTypeId: new ObjectId(filter1.fileTypeId), pid: new ObjectId(filter1.pid) }).then((workflows) => {
        response.status(200).json(workflows).end();
    }).catch((e) => {
        response.status(500).json().end();
    })
}).get("/get-dashboard-tickers", (request: Request, response: Response) => {
    var pid = <string>request.query.pid;
    var pipeLine = [
        { $match: { pid: new ObjectId(pid) } },
        { $group: { _id: "$fileTypeId", totalLineCount: { $sum: "$linesCount" }, fileCount: { $sum: 1 } } },
        { $lookup: { from: "fileTypeMaster", localField: "_id", foreignField: "_id", as: "fileTypeMaster" } },
        { $unwind: { path: "$fileTypeMaster", preserveNullAndEmptyArrays: true } },
        { $project: { filetypeid: "$_id", totalLineCount: 1, fileCount: 1, fileTypeName: "$fileTypeMaster.fileTypeName" } }
    ];
    appService.mongooseConnection.collection("fileMaster").aggregate(pipeLine).toArray().then((data: any) => {
        response.status(200).json(data).end();
    }).catch((e) => {
        response.status(500).json().end();
    })
}).get("/get-projects", (request: Request, response: Response) => {
    var pipeLine = [
        { $lookup: { from: "languageMaster", localField: "lid", foreignField: "_id", as: "languageMaster" } },
        { $unwind: { path: "$languageMaster", preserveNullAndEmptyArrays: true } }];
    appService.mongooseConnection.collection("projectMaster").aggregate(pipeLine).toArray().then((data: any) => {
        response.status(200).json(data).end();
    }).catch((e) => {
        response.status(500).json().end();
    })
});

module.exports = dashBoardRouter;