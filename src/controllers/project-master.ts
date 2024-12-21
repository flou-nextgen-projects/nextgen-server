import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose from "mongoose";
import { join, resolve } from "path";
import { appService } from "../services/app-service";
import { FileContentMaster, FileMaster, ProcessingStatus, ProjectMaster, WorkspaceMaster } from "../models";
import mongoose from "mongoose";
import { extractProjectZip, Upload, FileExtensions } from "nextgen-utilities";
import { existsSync, readFileSync } from "fs";
import { AppError } from "../common/app-error";
import { prepareNodes, prepareLinks } from "../models";

const pmRouter: Router = Express.Router();
const fileExtensions = new FileExtensions();
pmRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/docs", async (request: Request, response: Response, next: NextFunction) => {
    let pid: string = <string>request.query.pid;
    let projects = await appService.mongooseConnection.collection("projectMaster").aggregate([
        { $match: { _id: new Mongoose.Types.ObjectId(pid) } },
        { $lookup: { from: "fileMaster", localField: "_id", foreignField: "pid", as: "docs" } },
        { $sort: { lineIndex: 1 } }
    ]).toArray();
    let project = projects.shift(); // need to check
    response.status(200).json(project).end();
}).post("/add-project", async function (request: Request, response: Response) {
    var pm = request.body;
    var projectMaster: ProjectMaster = await appService.projectMaster.addItem(pm);
    response.status(200).json(projectMaster).end();
}).post("/", async function (request: Request, response: Response) {
    var pm = request.body;
    let checkExisting = await appService.projectMaster.getItem({ name: pm.name });
    if (checkExisting) return response.status(202).json({ message: `Project with same name already exists: ${pm.name}` }).end();
    var projectMaster: ProjectMaster = await appService.projectMaster.addItem(pm);
    extractProjectZip(projectMaster).then(async (extractPath: string) => {
        // const fileName = fileExtensions.getNameWithoutExtension(projectMaster.uploadDetails.fileName);
        // var extractedPath = join(extractPath, fileName);
        let totalFiles = fileExtensions.getAllFilesFromPath(extractPath);
        var doc = await appService.projectMaster.findByIdAndUpdate(projectMaster._id, { extractedPath: extractPath, totalObjects: totalFiles.length });
        await projectProcessingStages(projectMaster._id);
        response.status(200).json(doc).end();
    }).catch((err: any) => {
        response.status(500).json(err).end();
    });
}).get("/get-all", async function (request: Request, response: Response) {
    let filter = JSON.parse(<string>request.query.filter || null) || null;
    let $pipeLine = !filter ? [] : [{ $match: filter }];
    var projectMaster: Array<ProjectMaster> = await appService.projectMaster.aggregate($pipeLine);
    response.status(200).json(projectMaster).end();
}).get("/get-process-stages", async function (request: Request, response: Response) {
    var projectId: string = <string>request.query.pid;
    var processingStages = await appService.processingStages.getDocuments({
        pid: new Mongoose.Types.ObjectId(projectId)
    });
    response.status(200).json(processingStages).end();
}).post("/upload-project", function (request: any, response: Response) {
    let rootDir = resolve(join(__dirname, "../", "../"));
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
}).get("/nodes-and-links/:pid", async function (request: Request, response: Response) {
    let pid: string = <string>request.params.pid;
    let nodesAndLinks = await appService.objectConnectivity.getDocuments({
        pid: new Mongoose.Types.ObjectId(pid)
    });
    response.status(200).json(nodesAndLinks).end();
}).post("/upload-project-bundle", async function (request: any, response: Response) {
    try {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        let rootDir = resolve(join(__dirname, "../", "../"));
        let uploadDetails = request.body;
        request.rootDir = rootDir;
        function checkWrite(err: any) {
            if (err) {
                response.json({ message: "Error occurred during extraction", error: err }).end();
            }
        }
        response.write(formatData({ message: "Starting extraction of project .zip" }), "utf-8", checkWrite);
        await sleep(500);
        extractProjectZip({ uploadDetails: uploadDetails }).then(async (extractPath: string) => {
            response.write(formatData({ message: "Zip extracted successfully" }), "utf-8", checkWrite);

            let allFiles = fileExtensions.getAllFilesFromPath(join(extractPath, "project-files"), [], true);
            // read project-master.json file from project-master folder and create project
            let pJson = await readJsonFile(join(extractPath, "project-master", "project-master.json"));
            let project = await addProject(allFiles.length, extractPath, uploadDetails, pJson);

            response.write(formatData({ message: "Project details are uploaded successfully." }), "utf-8", checkWrite);
            await sleep(200);

            // get file-master data            
            let fileJson: any[] = await readJsonFile(join(extractPath, "file-master", "file-master.json"));
            response.write(formatData({ message: "Started adding file master details to DB." }), "utf-8", checkWrite);

            await addFileDetails(allFiles, project, fileJson);

            response.write(formatData({ extra: { totalFiles: allFiles.length }, message: `File details are added to DB successfully` }), "utf-8", checkWrite);

            // process for network connectivity
            response.write(formatData({ message: "Started processing network connectivity." }), "utf-8", checkWrite);
            let networkJson: any[] = await readJsonFile(join(extractPath, "object-connectivity", "object-connectivity.json"));
            await processNetworkConnectivity(project, networkJson);

            response.write(formatData({ message: "You can start loading project now." }), "utf-8", checkWrite);
            response.end();
        }).catch((err: any) => {
            response.end(formatData({ exception: { ...err } }));
        });
    } catch (error) {
        response.end(formatData(error));
    }
}).get("/regenerate-object-connectivity/:pid", async function (request: Request, response: Response) {
    let pid: string = <string>request.params.pid;
    let project = await appService.projectMaster.findById(new Mongoose.Types.ObjectId(pid));
    if (!project) return response.status(404).end();

    let extractPath = project.extractedPath;
    let collection = appService.mongooseConnection.collection("objectConnectivity");
    await collection.deleteMany({ pid: new Mongoose.Types.ObjectId(pid) });
    let networkJson: any[] = await readJsonFile(join(extractPath, "object-connectivity", "object-connectivity.json"));
    await processNetworkConnectivity(project, networkJson);
    response.status(200).json({ message: "Network connectivity is regenerated successfully." }).end();
}).get("/reprocess-file-contents/:pid", async function (request: Request, response: Response) {
    let pid: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.pid);
    let project = await appService.projectMaster.findById(pid);
    if (!project) return response.status(404).end();

    let collection = appService.fileContentMaster.getModel();
    await collection.deleteMany({ pid });
    let allFiles = await appService.fileMaster.getDocuments({ pid });
    for (let file of allFiles) {
        let content = fileExtensions.readTextFile(file.filePath);
        if (content === "") continue;
        await appService.fileContentMaster.addItem({ fid: file._id, fileContent: content } as FileContentMaster);
    }
    response.status(200).json({ message: "File contents processed successfully." }).end();
});

const processNetworkConnectivity = async (pm: ProjectMaster, networkJson: any[]) => {
    let allFiles = await appService.fileMaster.aggregate([{ $match: { pid: pm._id } }]);
    let nodes = prepareNodes(networkJson);
    let links = prepareLinks(networkJson, nodes);
    let collection = appService.mongooseConnection.collection("objectConnectivity");
    for (let node of nodes) {
        let fm = allFiles.find((f) => f.fileName === node.name && node.fileType.toLowerCase() === f.fileTypeMaster.fileTypeName.toLowerCase());
        node.pid = pm._id;
        node.fileId = fm._id;
        await collection.insertOne(node);
    }
    for (let link of links) {
        link.pid = pm._id;
        await collection.insertOne(link);
    }
};

const addFileDetails = async (allFiles: string[], pm: ProjectMaster, fileMasterJson: any[]) => {
    const fileTypeMaster = await appService.fileTypeMaster.getDocuments({ lid: pm.lid });
    let fileInfos = allFiles.map((file) => {
        let info = fileExtensions.getFileInfo(file);
        return { ...info, filePath: file }
    });
    for (const fm of fileMasterJson) {
        let fileInfo = fileExtensions.getFileInfo(fm.FilePath);
        let fileType = fileTypeMaster.find((ftm: any) => ftm.fileTypeName.toLowerCase() === fm.FileType.toLowerCase() && ftm.fileTypeExtension.toLowerCase() === fileInfo.ext.toLowerCase());
        let file = fileInfos.find((fm: any) => fm.name.toLowerCase() === fileInfo.name.toLowerCase() && fm.ext.toLowerCase() === fileInfo.ext.toLowerCase());
        let fileDetails = {
            pid: pm._id,
            fileTypeId: fileType._id,
            fileName: fm.FileName,
            filePath: file.filePath,
            linesCount: fm.LinesCount,
            processed: true,
            fileNameWithoutExt: fileExtensions.getNameWithoutExtension(fm.FilePath),
            fileStatics: { lineCount: fm.LinesCount, parsed: true, processedLineCount: fm.DoneParsing }
        } as FileMaster;
        await appService.fileMaster.addItem(fileDetails);
    }
};

const addProject = async (totalObjects: number, extractPath: string, uploadDetails: any, pJson: any) => {
    let languageMaster = await appService.languageMaster.getItem({ name: pJson.LanguageName });
    if (!languageMaster) throw new AppError("Language does not exist", 404, { code: 404, name: pJson.LanguageName });
    // we'll create new workspace with the same name as pJson.Name for reference purposes
    let workspace = await appService.workspaceMaster.getItem({ name: pJson.Name });
    if (!workspace) {
        workspace = await appService.workspaceMaster.addItem({ name: pJson.Name, lid: languageMaster._id, description: `This is ${pJson.Name} Workspace` } as WorkspaceMaster);
    }
    let projectMaster = {
        name: pJson.Name,
        lid: languageMaster._id,
        wid: workspace._id,
        description: pJson.Description,
        uploadDetails: uploadDetails,
        extractedPath: extractPath,
        uploadedPath: uploadDetails.uploadPath,
        totalObjects: totalObjects,
        processingStatus: ProcessingStatus.processed,
        uploadedOn: new Date(),
        processedOn: new Date()
    } as ProjectMaster;
    // add project to database and return projectMaster
    let project = await appService.projectMaster.getItem({ name: projectMaster.name });
    if (!project) {
        project = await appService.projectMaster.addItem(projectMaster);
    }
    return project;
};
const formatData = (json: any) => {
    return `${JSON.stringify({ data: json })}\n`;
}
async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const readJsonFile = (path: string): Promise<any[] | any> => new Promise((resolve, reject) => {
    if (!existsSync(path)) return reject({ message: "File does not exist", code: 404, path });
    let json = readFileSync(path, 'utf8').toString();
    try {
        let jsonData = JSON.parse(json);
        resolve(jsonData);
    } catch (error) {
        reject({ message: "Error parsing JSON", code: 500, error });
    }
});

const processingStages: Array<{ stepName: string, stage?: string, tableName?: string, canReprocess: boolean, description: string }> = [{
    stepName: "check directory structure",
    stage: "confirmDirectoryStructure",
    description: "Confirm directory structure with necessary folders",
    canReprocess: true
}, {
    stepName: "change file extensions",
    stage: "changeExtensions",
    description: "Change file extensions like .jcl, .icd, .proc etc.",
    canReprocess: true
}, {
    stepName: "extract file details",
    stage: "processFileMasterData",
    description: "Extract all file details like name, path, LoC etc.",
    canReprocess: true
}, {
    stepName: "process JCL files",
    stage: "processJCLFiles",
    description: "Process JCL files",
    canReprocess: true
}, {
    stepName: "process CopyBook files",
    stage: "processCopyBookFiles",
    description: "Process Copybook files",
    canReprocess: true
}, {
    stepName: "process PROC files",
    stage: "processProcFiles",
    description: "Process PROC files",
    canReprocess: true
}, {
    stepName: "process BMS files",
    stage: "processBMSFiles",
    description: "Process BMS files",
    canReprocess: true
}, {
    stepName: "process InputLib files",
    stage: "processInputLibFiles",
    description: "Process InputLib files",
    canReprocess: true
}, {
    stepName: "process SQL files",
    stage: "processSqlFiles",
    description: "Process SQL files",
    canReprocess: true
}, {
    stepName: "process COBOL files",
    stage: "processCobolFiles",
    description: "Process COBOL files",
    canReprocess: true
}];

const projectProcessingStages = async function (pid: mongoose.Types.ObjectId | string) {
    for (const step of processingStages) {
        var processingStep: any = {
            pid,
            stage: step.stage,
            stepName: step.stepName,
            description: step.description,
            startedOn: null,
            completedOn: null,
            canReprocess: step.canReprocess,
            processDetails: {
                tableName: step.canReprocess ? step?.tableName : ""
            }
        };
        await appService.processingStages.addItem(processingStep);
    }
};

module.exports = pmRouter;