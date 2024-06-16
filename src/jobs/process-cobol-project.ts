import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { CobolProcessStagesToExecute } from "../helpers/cobol/cobol-process-stages";

const cobolProcessRouter: Router = Express.Router();
cobolProcessRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/start-processing/:id", async function (request: Request, response: Response, next: NextFunction) {
    const _id = <string>request.params.id;
    const project = await appService.projectMaster.findById(_id);
    if (!project) response.status(404).send("Project details not found!");
    if (project.processingStatus > 0) return response.status(404).json({
        status: "Project is either processed or processing!.",
        project: project
    }).end();
    // mark this stage as completed and send response back and redirect to next route for processing    
    response.status(200).json({ message: "Project processing has been started!", project });
    // response.status(200).redirect(301, "/flo-jobs/api/cobol-process/change-extensions");
    // now we need to keep processing further stages.
    // calling change extensions stage from Execution    
    const executeStage: Function = CobolProcessStagesToExecute.getStage('changeExtensionsStage');
    executeStage(_id);
}).get("/execute-stage/:pid/:stageName", async function (request: Request, response: Response) {
    const stageName = <string>request.params.stageName;
    const _id = <string>request.params.pid;
    const executeStage: Function = CobolProcessStagesToExecute.getStage(stageName);
    executeStage(_id);
    response.status(200).json({ message: `Started executing stage: ${stageName}`, pid: _id }).end();
});


module.exports = cobolProcessRouter;