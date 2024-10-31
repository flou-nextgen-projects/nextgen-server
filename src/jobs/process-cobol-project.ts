import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import Mongoose from "mongoose";
import { CobolProcessToExecute } from "../helpers/cobol/cobol-process-stages";

const cobolProcessRouter: Router = Express.Router();
cobolProcessRouter.use("/", (_: Request, __: Response, next: NextFunction) => {
    next();
}).get("/start-processing/:id", async function (request: Request, response: Response, next: NextFunction) {
    const _id = <string>request.params.id;
    const project = await appService.projectMaster.findById(_id);
    if (!project) response.status(404).send("Project details not found");
    if (project.processingStatus > 0) return response.status(404).json({
        status: "Project is either processed or processing.",
        project: project
    }).end();
    // mark this stage as completed and send response back and redirect to next route for processing    
    response.status(200).json({ message: "Project processing has been started!", project });
    // response.status(200).redirect(301, "/flo-jobs/api/cobol-process/change-extensions");
    // now we need to keep processing further stages.
    // calling change extensions stage from Execution
    // introducing Kafka now - date: 12 July 2024
    // all processing steps will be executed by Kafka messages
    // we'll use topic for this is - cobol-processing and event-type will be process-step
    // we'll pass all necessary and required arguments into Kafka message and utilize them.

    // commented following block on 05/10/2024
    /*
    const processToExecute = new CobolProcessToExecute(project._id);
    const executeStage: Function = processToExecute.get('changeExtensions');
    executeStage(_id);
    */
    executeProcessActionsOnyByOne(project._id);
}).get("/execute-stage/:pid/:stageName", async function (request: Request, response: Response) {
    const stageName = <string>request.params.stageName;
    const _id = <string>request.params.pid;
    try {
        const processToExecute = new CobolProcessToExecute(_id);
        const executeStage: Function = processToExecute.get(stageName);
        executeStage(_id);
        response.status(200).json({ message: `Started executing stage: ${stageName}`, pid: _id }).end();
    } catch (error) {
        response.status(500).json({ message: `There was an error executing stage: ${stageName}`, pid: _id }).end();
    }
});

let executeProcessActionsOnyByOne = async (pid: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
    try {
        const processToExecute = new CobolProcessToExecute(pid);
        await processToExecute.changeExtensions(pid);
        await processToExecute.processFileMasterData(pid);
        await processToExecute.processJCLFiles(pid);
        await processToExecute.processCopyBookFiles(pid);
        await processToExecute.processProcFiles(pid);
        await processToExecute.processBMSFiles(pid);
        await processToExecute.processInputLibFiles(pid);
        await processToExecute.processSqlFiles(pid);
        await processToExecute.processCobolFiles(pid);
        await processToExecute.cobolProcessUtils.processDataDependency(pid);
    } catch (error) {
        console.log(error);
    } finally {

    }
});

module.exports = cobolProcessRouter;
module.exports.executeProcessActionsOnyByOne = executeProcessActionsOnyByOne;