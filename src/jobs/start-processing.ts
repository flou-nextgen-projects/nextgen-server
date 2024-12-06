import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
const { executeProcessActionsOnyByOne } = require("./process-cobol-project");
import ProcessCsharpProjects from "./process-csharp-projects";
import ProcessPlSqlProjects from "./process-pl-sql-project";

const startProcessRouter: Router = Express.Router();
startProcessRouter.use("/", (_: Request, __: Response, next: NextFunction) => {
    next();
}).get("/start-processing/:id", async function (request: Request, response: Response, next: NextFunction) {
    const _id = <string>request.params.id;
    const project = await appService.projectMaster.findById(_id);
    if (!project) response.status(404).send("Project details not found");
    if (project.processingStatus > 0) return response.status(404).json({
        status: "Project is either processed or processing", project: project
    }).end();
    const workspaces = await appService.workspaceMaster.aggregate([
        { $match: { _id: project.wid } },
        { $lookup: { from: 'languageMaster', localField: 'lid', foreignField: '_id', as: 'languageMaster' } }
    ]);
    let wm = workspaces.shift();
    if (wm.languageMaster.name === "C#") {
        const processCsharpProjects: ProcessCsharpProjects = new ProcessCsharpProjects();
        processCsharpProjects.startProcessing(wm._id.toString());
        response.status(200).json({ message: "Project processing has been started!" }).end();
    } else if (wm.languageMaster.name === "COBOL") {
        executeProcessActionsOnyByOne(project._id);
        response.status(200).json({ message: "Project processing has been started!" }).end();
    } else if (wm.languageMaster.name === "PLSQL") {
        const processPlSqlProjects: ProcessPlSqlProjects = new ProcessPlSqlProjects();
        processPlSqlProjects.executeProcessActionsOnyByOne(project._id);
        return response.status(204).json({ status: "Language not supported yet!" }).end();
    }
});

module.exports = startProcessRouter;