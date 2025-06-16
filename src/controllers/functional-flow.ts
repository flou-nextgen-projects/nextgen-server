import Express, { NextFunction, Request, Response } from "express"
import { appService } from "../services/app-service";
import { ObjectId } from "mongodb";

const functionalFlowRouter = Express.Router();
functionalFlowRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/get-workflows", async (request: Request, response: Response) => {
    var reqBody = request.body;
    var json: any = reqBody.jsonData;
    var pid: string = reqBody.pid;
    var fileTypeId: string = reqBody.fileTypeId;
    var lastIndex: number = json.length;
    var j = json[lastIndex - 1].id;
    var fileType = await appService.fileTypeMaster.getItem({ _id: new ObjectId(fileTypeId) });
    var level3Ele = json.find((d: any) => { return (d.data.level === 3 && d.data.type === `fileTypeNode-${fileType.fileTypeName}-${pid}`) });
    level3Ele.state.selected = true;
    try {
        var workflows = await appService.fileMaster.getDocuments({ pid: new ObjectId(pid), fileTypeId: new ObjectId(fileTypeId) });
        let userStories = await appService.mongooseConnection.collection("userStory").find().toArray();
        for (var workflow of workflows) {
            let userStory = userStories.find(x => x.fid.toString() === workflow._id.toString());
            var wName: string = `${workflow.fileNameWithoutExt || workflow.fileName}`;
            let nodeName = (userStory) ? `${wName} (${userStory.data})` : `${wName}`;
            json.push({ id: ++j, parent: `${level3Ele.id}`, text: nodeName, data: { pid: workflow.pid, aid: workflow._id, type: "workflow", level: 4 } });
        }
        response.status(200).json(json).end();
    } catch (err) {
        response.status(500).json(err).end();
    }
}).get("/get-initial-data", async (request: Request, response: Response) => {
    var wid = <string>request.query.wid;
    var jsonData: Array<any> = [];
    var i: number = 0;
    try {
        var projects = await appService.projectMaster.getDocuments({ wid: new ObjectId(wid) });
        for (const project of projects) {
            var name = project.name;
            var rootNode = { id: i++, parent: "#", text: "Epics", state: { selected: true }, data: { type: "epicNode", level: 0 } };
            var epicNameNode = { id: i++, parent: `${i - 2}`, text: `${name}`, state: { selected: true }, data: { type: "epicNodeName", level: 99 } };
            var featureNode = { id: i++, parent: `${i - 2}`, text: "Features", state: { selected: true }, data: { type: "featureNode", level: 1 } };
            jsonData.push(rootNode); jsonData.push(epicNameNode); jsonData.push(featureNode);
            let pipeLine = [
                { $match: { lid: project.lid } },
                { $lookup: { from: "fileMaster", localField: "_id", foreignField: "fileTypeId", as: "fileMaster" } },
                { $unwind: { path: "$fileMaster", preserveNullAndEmptyArrays: true } },
                { $group: { _id: "$fileTypeName", fileTypeName: { $first: "$fileTypeName" }, fileTypeId: { $first: "$_id" }, files: { $push: "$fileMaster" } } },
                { $match: { fileTypeName: { $in: ["COBOL", "JCL", "PROC", "SQL", "Code", "RPG"] } } }
            ];
            let result = await appService.mongooseConnection.collection("fileTypeMaster").aggregate(pipeLine).toArray();
            var parentId: number = jsonData.find((d) => { return d.data.type === "featureNode" }).id;
            var projectNode: any = { id: i++, parent: `${parentId}`, text: `${name}`, state: { selected: true }, data: { pid: project._id, type: `pNameNode-${project._id}`, level: 2 } };
            jsonData.push(projectNode);
            for (const res of result) {
                let parent = jsonData.find((d) => { return d.data.type === `pNameNode-${project._id}` }).id;
                let fileTypeNode: any = {
                    id: i++, parent: `${parent}`, text: `${res.fileTypeName}`, state: { selected: true }, data: { pid: project._id, fileTypeId: res.fileTypeId, type: `fileTypeNode-${res.fileTypeName}-${project._id}`, level: 3 }
                };
                jsonData.push(fileTypeNode);
            }
        }
        response.status(200).json(jsonData).end();
    } catch (err) {
        response.status(500).json(jsonData).end();
    }
});
module.exports = functionalFlowRouter;