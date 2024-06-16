import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose from "mongoose";
import { join, resolve } from "path";
import { appService } from "../services/app-service";
import { ProjectMaster } from "../models";
import mongoose from "mongoose";
import { extractProjectZip, Upload, FileExtensions } from "yogeshs-utilities";

const pmRouter: Router = Express.Router();
const fileExtensions = new FileExtensions();
pmRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/add-project", async function (request: Request, response: Response) {
    var pm = request.body;
    var projectMaster: ProjectMaster = await appService.projectMaster.addItem(pm);
    response.status(200).json(projectMaster).end();
}).post("/", async function (request: Request, response: Response) {
    var pm = request.body;
    var projectMaster: ProjectMaster = await appService.projectMaster.addItem(pm);
    await addProjectProcessingSteps(projectMaster._id);
    extractProjectZip(projectMaster).then(async (extractPath: string) => {
        const fileName = fileExtensions.getNameWithoutExtension(projectMaster.uploadDetails.fileName);
        var extractedPath = join(extractPath, fileName);
        var doc = await appService.projectMaster.findByIdAndUpdate(projectMaster._id, { extractedPath });
        response.status(200).json(doc).end();
    }).catch((err: any) => {
        response.status(500).json(err).end();
    });
}).get("/get-all", async function (request: Request, response: Response) {
    var projectMaster: Array<ProjectMaster> = await appService.projectMaster.getAllDocuments();
    response.status(200).json(projectMaster).end();
}).post("/upload-project", function (request: any, response: Response) {
    let rootDir = resolve(join(__dirname, "../"));
    request.rootDir = rootDir;
    Upload(request, response, function (err: any) {
        if (err) {
            response.status(500).send(JSON.stringify(err));
        } else {
            response.status(200).send(JSON.stringify({
                status: "File(s) uploaded successfully",
                uploadDetails: request.uploadDetails
            }));
        }
    });
});
const cobolProcessingSteps: Array<{ stepName: string, tableName?: string, canReprocess: boolean, description: string }> = [{
    stepName: "ConfirmDirectoryStructure",
    description: "Confirm directory structure with necessary files",
    canReprocess: false
}, {
    stepName: "ChangeFileExtensions",
    description: "Change file extensions depending upon directory structure like .jcl, .icd",
    canReprocess: false
}, {
    stepName: "ExtractFileDetails",
    description: "Extract all file details in file master details table",
    canReprocess: false
}];

const addProjectProcessingSteps = async function (pid: mongoose.Types.ObjectId | string) {
    for (const step of cobolProcessingSteps) {
        var processingStep: any = {
            pid,
            stepName: step.stepName,
            description: step.description,
            startedOn: null,
            completedOn: null,
            canReprocess: step.canReprocess,
            processDetails: {
                tableName: step.canReprocess ? step?.tableName : ""
            }
        };
        await appService.processingSteps.addItem(processingStep);
    }
};

const getProjectProcessSteps = async function (request: Request, response: Response) {
    var projectId: string = <string>request.query.projectId;
    var processingSteps = await appService.processingSteps.getDocuments({
        pid: new Mongoose.Types.ObjectId(projectId)
    });
    response.status(200).json(processingSteps).end();
};

export {
    getProjectProcessSteps,
}

module.exports = pmRouter;