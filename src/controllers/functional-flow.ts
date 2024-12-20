import Express, { NextFunction, Request, Response } from "express"
import { appService } from "../services/app-service";
import { ObjectId } from "mongodb";
const functionalFlowRouter = Express.Router();
functionalFlowRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-initial-data", async (request: Request, response: Response, next: NextFunction) => {
    var pid = request.query.pid;
    var jsonData: Array<any> = [];
    var i: number = 0;
    try {
        var rootNode = { id: i++, parent: "#", text: "Epics", data: { type: "epicNode", level: 0 } };
        var epicNameNode = { id: i++, parent: `${i - 2}`, text: "Banking App", data: { type: "epicNodeName", level: 99 } };
        var featureNode = { id: i++, parent: `${i - 2}`, text: "Features", data: { type: "featureNode", level: 1 } };
        jsonData.push(rootNode); jsonData.push(epicNameNode); jsonData.push(featureNode);
        var projects = await appService.projectMaster.getAllDocuments();
        for (var project of projects) {
            var prjName = project.name;
            var prjParentId: number = jsonData.find((d) => { return d.data.type === "featureNode" }).id;
            var projectNode: any = { id: i++, parent: `${prjParentId}`, text: `${prjName}`, data: { pid: project._id, type: `prjNameNode-${project._id}`, level: 2 } };
            jsonData.push(projectNode);

            var functionNodeParent: number = jsonData.find((x) => { return x.data.type === `prjNameNode-${project._id}` }).id;
            var functionNode: any = { id: i++, parent: `${functionNodeParent}`, text: "Functions(User Stories)", state: { selected: false }, data: { pid: project._id, type: `funcNode-${project._id}`, level: 3 } };
            jsonData.push(functionNode);
            response.status(200).json(jsonData).end();
        }
    } catch (err) {
        response.status(500).json(jsonData).end();
    }
}).post("/get-workflows", async (request: Request, response: Response) => {
    var pid: string = <string>request.query.pid;
    var json: any = <any>request.body;
    var lastIndex: number = json.data.length;
    var j = json.data[lastIndex - 1].id;
    var level3Ele = json.data.find((d: any) => { return (d.data.level === 3 && d.data.type === `funcNode-${pid}`) });
    level3Ele.state.selected = true;
    try {
        var workflows = await appService.fileMaster.getDocuments({ pid: new ObjectId(pid) });
        for (var workflow of workflows) {
            var wName: string = `${workflow.fileNameWithoutExt}`;
            json.data.push({ id: ++j, parent: `${level3Ele.id}`, text: `${wName}`, data: { pid: workflow.pid, aid: workflow._id, type: "workflow", level: 4 } });
        }
        response.status(200).json(json.data).end();
    } catch (err) {
        response.status(500).json(err).end();
    }
});
module.exports = functionalFlowRouter;