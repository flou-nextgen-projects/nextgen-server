import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { ObjectId } from "mongodb";
import Mongoose from "mongoose";
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
        { $match: { pid: new ObjectId(pid) } },
        { $lookup: { from: "fileTypeMaster", localField: "fileTypeId", foreignField: "_id", as: "fileTypeMaster" } },
        { $unwind: { path: "$fileTypeMaster", preserveNullAndEmptyArrays: true } }
    ];
    appService.mongooseConnection.collection("fileMaster").aggregate(pipeLine).toArray().then((data: any) => {
        response.status(200).json(data).end();
    }).catch((e) => {
        response.status(500).json().end();
    })
}).get("/get-file-master", (request: Request, response: Response) => {
    var filter: any = request.query;
    var filter1: any = JSON.parse(filter.$filter);
    appService.fileMaster.getItem({ _id: new ObjectId(filter1.fileId), pid: new ObjectId(filter1.pid) }).then((workflows) => {
        response.status(200).json(workflows).end();
    }).catch((err) => {
        response.status(500).json(err).end();
    })
}).get("/get-workflows-by-fileId", (request: Request, response: Response) => { // this api is written for generating treeData on right panel on object connectivity page
    var filter: any = request.query;
    var filter1: any = JSON.parse(filter.$filter);
    appService.memberReferences.getItem({ fid: new Mongoose.Types.ObjectId(filter1.fid) }).then((result: any) => {
        response.status(200).json(result).end();
    }).catch((err) => {
        response.status(500).json(err).end();
    })
});
module.exports = fmRouter;