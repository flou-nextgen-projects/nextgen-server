import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import mongoose, { mongo, PipelineStage } from "mongoose";
const fmRouter: Router = Express.Router();

fmRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-all", async (request: Request, response: Response) => {
    try {
        const fileMaster = await appService.fileMaster.getAllDocuments(30);
        response.status(200).json(fileMaster).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
}).get("/get-documents", (request: Request, response: Response) => {
    const filter: object = {
        FileTypeMasterId: request.body.FileTypeMasterId,
        FileNameWithoutExt: new RegExp(request.body.FileNameWithoutExt, 'i')
    }
    appService.fileMaster.getDocuments(filter).then((res) => {
        response.status(200).json(res).end();
    }).catch((error: Error) => {
        response.status(500).json(error);
    });
}).get("/aggregate-all", async (request: Request, response: Response) => {
    try {
        const pipeLine = [{ $addFields: { FullName: { $concat: ["$FirstName", " ", "$LastName"] } } }];
        const userMasters = await appService.userMaster.aggregate(pipeLine);
        response.status(200).json(userMasters).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
}).get("/get-file-masters", (request: Request, response: Response) => {
    var filter: any = request.query;
    var filter1: any = JSON.parse(filter.$filter);
    var pid = filter1.pid;
    var pipeLine = [
        { $match: { pid: mongoose.Types.ObjectId.createFromHexString(pid) } },
        { $lookup: { from: "fileTypeMaster", localField: "fileTypeId", foreignField: "_id", as: "fileTypeMaster" } },
        { $unwind: { path: "$fileTypeMaster", preserveNullAndEmptyArrays: true } }
    ];
    appService.mongooseConnection.collection("fileMaster").aggregate(pipeLine).toArray().then((data: any) => {
        response.status(200).json(data).end();
    }).catch((e) => {
        response.status(500).json().end();
    });
}).get("/get-file-master", (request: Request, response: Response) => {
    var query: any = request.query;
    var $filter: any = JSON.parse(query.$filter);
    appService.fileMaster.getItem({ _id: mongoose.Types.ObjectId.createFromHexString($filter.fileId), pid: mongoose.Types.ObjectId.createFromHexString($filter.pid) }).then((workflows) => {
        response.status(200).json(workflows).end();
    }).catch((err) => {
        response.status(500).json(err).end();
    });
}).get("/get-workflows-by-fileId", async (request: Request, response: Response) => {
    var query: any = request.query;
    var $filter: any = JSON.parse(query.$filter);
    let member = await appService.memberReferences.aggregateOne([
        { $match: { fid: mongoose.Types.ObjectId.createFromHexString($filter.fid) } },
        { $lookup: { from: "projectMaster", localField: "pid", foreignField: "_id", as: "projectMaster" } },
        { $unwind: { preserveNullAndEmptyArrays: true, path: "$projectMaster" } },
        { $lookup: { from: "languageMaster", localField: "projectMaster.lid", foreignField: "_id", as: "languageMaster" } },
        { $unwind: { preserveNullAndEmptyArrays: true, path: "$languageMaster" } },
    ]);
    if (!member) {
        return response.status(404).json([]).end();
    }
    if (member.languageMaster.name === "COBOL") {
        return response.status(200).json([member]).end();
    }
    // we need to delete other callExternals from the memberReference if workflowStatus is not actualWorkflow
    let workflowStatus = member.callExternals.filter((x: any) => x.workFlowStatus == "actualWorkflow");
    workflowStatus.forEach((e: any) => { e.missing = false; });
    member.callExternals = workflowStatus;
    response.status(200).json([member]).end();
}).get("/get-inventory-data/:pid", async (request: Request, response: Response) => {
    var pid = request.params.pid;
    try {
        let pipeline = [
            { $match: { pid: mongoose.Types.ObjectId.createFromHexString(pid) } },
            { $lookup: { from: "memberReferences", localField: "_id", foreignField: "fid", as: "memberReferences" } },
            { $unwind: { path: "$memberReferences", preserveNullAndEmptyArrays: true } }
        ];
        let result: Array<any> = await appService.fileMaster.aggregate(pipeline);
        let memberRef: Array<any> = await appService.memberReferences.getDocuments({ pid: mongoose.Types.ObjectId.createFromHexString(pid) });
        for (const element of result) {
            let statements = await appService.statementMaster.aggregate([
                { $match: { pid: mongoose.Types.ObjectId.createFromHexString(pid), fid: mongoose.Types.ObjectId.createFromHexString(element._id.toString()), indicators: { $in: [7] } } },
            ]);
            element.complexity = statements.length;
        }
        for (const element of result) {
            element.calledFrom = [];
            for (const ref of memberRef) {
                let calls = ref.callExternals.filter((x: any) => x.fileName == element.fileNameWithoutExt);
                if (calls.length == 0) continue;
                element.calledFrom.push({ fileName: `${ref.fileName}`, type: ref.fileType });
            }
        }
        response.status(200).json(result).end();
    } catch (error) {
        response.status(500).json(error).end();
    }
});
module.exports = fmRouter;