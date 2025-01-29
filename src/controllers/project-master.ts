import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose from "mongoose";
import { join, resolve } from "path";
import { appService } from "../services/app-service";
import { FileContentMaster, FileMaster, LanguageMaster, ProcessingStatus, ProjectMaster, WorkspaceMaster } from "../models";
import { extractProjectZip, Upload, FileExtensions, formatData, readJsonFile, sleep } from "nextgen-utilities";
import { existsSync } from "fs";
import { AppError } from "../common/app-error";
import { prepareNodes, prepareLinks, prepareDotNetLinks } from "../models";
import { convertMemberReferencesArray } from "../helpers";

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
    try {
        let pid: string = <string>request.params.pid;
        let project = await appService.projectMaster.findById(pid);
        if (!project) response.status(404).json({ message: 'Project with provided ID not found' }).end();
        let nodesAndLinks = await appService.objectConnectivity.getDocuments({ wid: project.wid }, {}, {}, { _id: 1 });
        response.status(200).json(nodesAndLinks).end();
    } catch (error) {
        response.status(500).json({ error }).end();
    }
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
        response.write(formatData({ message: "Starting extraction of project project bundle" }), "utf-8", checkWrite);

        await sleep(500);

        extractProjectZip({ uploadDetails: uploadDetails }).then(async (extractPath: string) => {
            response.write(formatData({ message: "Project bundle extracted successfully." }), "utf-8", checkWrite);

            await sleep(1000);
            // response for reading file details from extracted path
            response.write(formatData({ message: "Reading file details from extracted path." }), "utf-8", checkWrite);
            let allFiles = fileExtensions.getAllFilesFromPath(join(extractPath, "project-files"), [], true);

            // read workspace-master.json file from workspace-master folder and create workspace
            // this will work in case of C# language - for now
            let wmJsonPath = join(extractPath, "workspace-master", "workspace-master.json");

            if (!existsSync(wmJsonPath)) {
                response.write(formatData({ message: "Workspace master JSON not found, so using project master JSON for creating workspace." }), "utf-8", checkWrite);
                response.end();
            }

            let readWsJson = await readJsonFile(wmJsonPath);

            if ([500, 404].includes(readWsJson.code)) return response.end(formatData({ message: 'Workspace JSON not found' }));

            let workspace: WorkspaceMaster = undefined;
            if (readWsJson.code === 200) {
                let wJson = readWsJson.data;
                workspace = await addWorkspace(extractPath, wJson);
            }

            let languageMaster = await appService.languageMaster.getItem({ _id: workspace.lid });
            // read project-master.json file from project-master folder and create project
            let pmJsonPath = join(extractPath, "project-master", "project-master.json");
            let readPrJson = await readJsonFile(pmJsonPath);

            if ([500, 404].includes(readPrJson.code)) return response.end(formatData({ message: 'Project JSON not found' }));

            if (readPrJson.code === 200) {
                await addProject(allFiles.length, extractPath, uploadDetails, readPrJson.data, workspace);
            }

            response.write(formatData({ message: "Project and Workspace details added successfully." }), "utf-8", checkWrite);
            await sleep(200);

            // get file-master data
            let readFmJson = await readJsonFile(join(extractPath, "file-master", "file-master.json"));
            if (readFmJson.code === 200) {
                response.write(formatData({ message: "Started adding file master details to repository." }), "utf-8", checkWrite);
                await addFileDetails(allFiles, languageMaster, readFmJson.data);
            }

            response.write(formatData({ extra: { totalFiles: allFiles.length }, message: `File details are added successfully to repository.` }), "utf-8", checkWrite);

            // process for network connectivity
            response.write(formatData({ message: "Started processing network connectivity." }), "utf-8", checkWrite);
            let netJson = await readJsonFile(join(extractPath, "member-references", "member-references.json"));
            if (netJson.code === 200) {
                await processNetworkConnectivity(languageMaster, workspace, netJson.data);
                // process for member details
                response.write(formatData({ message: "Started process for adding member references to repository." }), "utf-8", checkWrite);
                await addMemberReference(workspace, netJson.data);
                // special case for dot net repositories
                await addDotNetMemberReferences(workspace, netJson.data);
            }

            // process for method details
            response.write(formatData({ message: "Started process for adding method details to repository." }), "utf-8", checkWrite);
            let methodDetailsJson: any = await readJsonFile(join(extractPath, "method-details", "method-details.json"));
            if (methodDetailsJson.code === 200) {
                await addMethodDetails(workspace, methodDetailsJson.data);
            }

            // process for method details
            response.write(formatData({ message: "Started process for adding field and properties details to repository." }), "utf-8", checkWrite);
            let fieldAndPropertiesJson: any = await readJsonFile(join(extractPath, "field-and-properties", "field-and-properties.json"));
            if (fieldAndPropertiesJson.code === 200) {
                await addDotNetFieldAndPropertiesDetails(workspace, fieldAndPropertiesJson.data);
            }

            // process for statement master
            response.write(formatData({ message: "Started process for statement references details to repository." }), "utf-8", checkWrite);
            let statementReferencesJson: any = await readJsonFile(join(extractPath, "statement-master", "statement-master.json"));
            if (statementReferencesJson.code === 200) {
                await addStatementReferences(workspace, statementReferencesJson.data);
            }

            // process for file contents...
            response.write(formatData({ message: "Started processing file contents to repository." }), "utf-8", checkWrite);
            await processFileContents(workspace);

            response.write(formatData({ message: "You can start loading project now." }), "utf-8", checkWrite);
            response.end();
        }).catch((err: any) => {
            console.log(err);
            response.end(formatData(err));
        });
    } catch (error) {
        response.end(formatData(error));
    }
}).get("/reprocess-network-connectivity/:wid", async function (request: Request, response: Response) {
    let wid: string = <string>request.params.wid;
    let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id: new Mongoose.Types.ObjectId(wid) } }]);
    if (!workspace) return response.status(404).end();
    let extractPath: string = <string>workspace.dirPath;
    let networkJson: any = await readJsonFile(join(extractPath, "member-references", "member-references.json"));
    if (networkJson.code === 200) {
        await processNetworkConnectivity(workspace.languageMaster, workspace, networkJson.data);
    }
    response.status(200).json({ message: "Network connectivity is regenerated successfully." }).end();
}).get("/reprocess-file-contents/:wid", async function (request: Request, response: Response) {
    let wid: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
    let projects = await appService.projectMaster.getDocuments({ wid });
    for (const project of projects) {
        let collection = appService.fileContentMaster.getModel();
        await collection.deleteMany({ pid: project._id });
        let allFiles = await appService.fileMaster.getDocuments({ pid: project._id });
        for (let file of allFiles) {
            let content = fileExtensions.readTextFile(file.filePath);
            if (content === "") continue;
            await appService.fileContentMaster.addItem({ fid: file._id, original: content } as FileContentMaster);
        }
    }
    response.status(200).json({ message: "File contents processed successfully." }).end();
}).get("/reprocess-file-details/:wid", async function (request: Request, response: Response) {
    let wid: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
    let workspace = await appService.workspaceMaster.findById(wid);
    if (!workspace) return response.status(404).end();
    let extractPath: string = <string>workspace.dirPath;
    let languageMaster = await appService.languageMaster.getItem({ _id: workspace.lid });
    let allFiles = fileExtensions.getAllFilesFromPath(join(workspace.dirPath, "project-files"));
    let fmJson = await readJsonFile(join(extractPath, "file-master", "file-master.json"));
    try {
        if (fmJson.code === 200) {
            await addFileDetails(allFiles, languageMaster, fmJson.data);
        }
        response.status(200).json({ message: "File master details processed successfully" }).end();
    } catch (error) {
        response.status(500).json(error).end();
    }
}).get("/reprocess-member-references/:wid", async function (request: Request, response: Response) {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        if (!workspace) return response.status(404).end();
        let extractPath: string = <string>workspace.dirPath;
        let memberReferencesJson: any = await readJsonFile(join(extractPath, "member-references", "member-references.json"));
        if (memberReferencesJson.code === 200) {
            await addMemberReference(workspace, memberReferencesJson.data);
            await addDotNetMemberReferences(workspace, memberReferencesJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(400).send(error).end();
    }
}).get("/reprocess-field-and-properties/:wid", async function (request: Request, response: Response) {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        if (!workspace) return response.status(404).end();
        let extractPath: string = <string>workspace.dirPath;
        let fieldAndPropertiesJson: any = await readJsonFile(join(extractPath, "field-and-properties", "field-and-properties.json"));
        if (fieldAndPropertiesJson.code === 200) {
            await addDotNetFieldAndPropertiesDetails(workspace, fieldAndPropertiesJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(400).send(error).end();
    }
}).get("/reprocess-statement-references/:wid", async function (request: Request, response: Response) {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        if (!workspace) return response.status(404).end();
        let extractPath: string = <string>workspace.dirPath;
        let statementReferencesJson: any = await readJsonFile(join(extractPath, "statement-master", "statement-master.json"));
        if (statementReferencesJson.code === 200) {
            await addStatementReferences(workspace, statementReferencesJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(400).send(error).end();
    }
}).get("/reprocess-missing-objects/:wid", async function (request: Request, response: Response) {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        if (!workspace) return response.status(404).end();
        let extractPath: string = <string>workspace.dirPath;
        let missingJson: any = await readJsonFile(join(extractPath, "missing-objects", "missing-objects.json"));
        if (missingJson.code === 200) {
            await addMissingObjects(missingJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(500).send().end();
    }
});

const addStatementReferences = async function addStatementReferences(wm: WorkspaceMaster, statementMastersJson: any[]): Promise<any> {
    try {
        let collection = appService.mongooseConnection.collection("statementMaster");
        await collection.deleteMany({ wid: wm._id });
        let modifiedStatementMasters = convertMemberReferencesArray(statementMastersJson);
        for (const statementMaster of modifiedStatementMasters) {
            await collection.insertOne(statementMaster);
        }
    } catch (error) {
        console.log(error);
    }
};
const addDotNetFieldAndPropertiesDetails = async function addDotNetFieldAndPropertiesDetails(wm: WorkspaceMaster, fieldAndPropertiesJson: any[]): Promise<any> {
    try {
        if (!(wm.languageMaster.name === "C#")) return;
        let collection = appService.mongooseConnection.collection("fieldAndPropertiesDetails");
        await collection.deleteMany({ wid: wm._id });
        let modifiedFieldAndProperties = convertMemberReferencesArray(fieldAndPropertiesJson);
        for (const fieldAndProperty of modifiedFieldAndProperties) {
            await collection.insertOne(fieldAndProperty);
        }
    } catch (error) {
        console.log(error);
    }
};
const addDotNetMemberReferences = async function addDotNetMemberReferences(wm: WorkspaceMaster, memberReferencesJson: any[]): Promise<any> {
    try {
        if (!(wm.languageMaster.name === "C#")) return;
        let collection = appService.mongooseConnection.collection("memberReferences");
        await collection.deleteMany({ wid: wm._id });
        let modifiedReferences = convertMemberReferencesArray(memberReferencesJson);
        for (const memberReference of modifiedReferences) {
            await collection.insertOne(memberReference);
        }
    } catch (error) {
        console.log(error);
    }
};
const addMethodDetails = async function addMethodDetails(wm: WorkspaceMaster, methodDetailsJson: any[]): Promise<any> {
    try {
        let collection = appService.mongooseConnection.collection("methodDetails");
        await collection.deleteMany({ wid: wm._id });
        let modifiedMethodDetails = convertMemberReferencesArray(methodDetailsJson);
        for (const methodDetails of modifiedMethodDetails) {
            await collection.insertOne(methodDetails);
        }
    } catch (error) {
        console.log(error);
    }
};
const addMissingObjects = async (missingJson: any[]) => {
    try {
        let distinctMissingList: Array<any> = [];
        missingJson.forEach((m) => {
            if (m.FileName == null) return;
            if (distinctMissingList.filter((x) => { return x.FileTypeName == m.FileTypeName && x.FileName == m.FileName }).length > 0) return;
            distinctMissingList.push(m);
        });
        for (const m of distinctMissingList) {
            if (m.FileName == null) continue;
            let missingObjDetail = {
                pid: Mongoose.Types.ObjectId.createFromHexString(m.ProjectId),
                wid: Mongoose.Types.ObjectId.createFromHexString(m.WorkspaceId),
                fileName: m.FileName,
                fileTypeName: m.FileTypeName
            } as any;
            await appService.mongooseConnection.collection("missingObjects").insertOne(missingObjDetail);
        }
    } catch (error) {
        console.log(error);
    }
};
const processFileContents = async (wm: WorkspaceMaster) => {
    let projects = await appService.projectMaster.getDocuments({ wid: wm._id });
    for (const project of projects) {
        let collection = appService.fileContentMaster.getModel();
        await collection.deleteMany({ pid: project._id });
        let allFiles = await appService.fileMaster.getDocuments({ pid: project._id });
        for (let file of allFiles) {
            let content = fileExtensions.readTextFile(file.filePath);
            if (content === "") continue;
            await appService.fileContentMaster.addItem({ fid: file._id, original: content } as FileContentMaster);
        }
    }
};
const processNetworkConnectivity = async (lm: LanguageMaster, wm: WorkspaceMaster, networkJson: any[]) => {
    let allFiles = await appService.fileMaster.aggregate([{ $match: { wid: wm._id } }]);
    var networkFiles: any[] = [];
    networkJson.forEach((nj) => {
        let file = allFiles.find((d) => d._id.toString() === (nj.fid || nj._id));
        if (!file) return;
        let find = networkFiles.find((d) => d._id.toString() === file._id.toString());
        if (find) return;
        networkFiles.push(file);
    });
    let nodes = prepareNodes(networkFiles);
    let links: any[] = [];
    // we'll add else if for other languages if needed.
    if (lm.name === "C#") {
        networkJson.forEach((d) => d.wid = wm._id);
        links = prepareDotNetLinks(networkJson, nodes);
    } else {
        links = prepareLinks(networkJson, nodes);
    }
    let collection = appService.mongooseConnection.collection("objectConnectivity");
    await collection.deleteMany({ wid: wm._id });
    for (let node of nodes) {
        await collection.insertOne(node);
    }
    for (let link of links) {
        await collection.insertOne(link);
    }
};
const addMemberReference = async (wm: WorkspaceMaster, memberRefJson: any[]) => {
    if (wm.languageMaster.name === "C#") return;
    for (const member of memberRefJson) {
        let fileType = await appService.fileTypeMaster.getItem({ fileTypeName: { $regex: new RegExp(`^${member.FileTypeName}$`, 'i') } });
        try {
            let callExts: Array<any> = [];
            for (const ce of member.CallExternals) {
                callExts.push({
                    fid: Mongoose.Types.ObjectId.isValid(ce._id) ? Mongoose.Types.ObjectId.createFromHexString(ce._id) : 0,
                    fileName: ce.FileName,
                    callExternals: ce.CallExternals,
                    wid: Mongoose.Types.ObjectId.createFromHexString(member.WorkspaceId),
                    fileTypeName: ce.FileTypeName,
                    pid: Mongoose.Types.ObjectId.createFromHexString(member.ProjectId),
                    missing: Mongoose.Types.ObjectId.isValid(ce._id) ? false : true
                });
            }
            let memberDetails = {
                wid: Mongoose.Types.ObjectId.createFromHexString(member.WorkspaceId),
                fid: Mongoose.Types.ObjectId.createFromHexString(member._id),
                pid: Mongoose.Types.ObjectId.createFromHexString(member.ProjectId),
                fileName: member.FileName,
                fileType: member.FileTypeName,
                fileTypeId: fileType._id,
                folderName: member.FolderName,
                callExternals: callExts
            } as any;
            await appService.mongooseConnection.collection("memberReferences").insertOne(memberDetails);
        } catch (ex) {
            console.log("Exception", ex);
        }
    }
};
const addFileDetails = async (allFiles: string[], lm: LanguageMaster, fileMasterJson: any[]) => {
    const fileTypeMaster = await appService.fileTypeMaster.getDocuments({ lid: lm._id });
    let fileInfos = allFiles.map((file) => {
        let info = fileExtensions.getFileInfo(file);
        let path = file.substring(file.indexOf("project-files\\") + 14);
        return { ...info, filePath: file, path };
    });

    for (const fm of fileMasterJson) {
        try {
            let fileType = fileTypeMaster.find((ftm: any) => ftm.fileTypeName.toLowerCase() === fm.FileTypeName.toLowerCase() && ftm.fileTypeExtension.toLowerCase() === fm.FileTypeExtension.toLowerCase());
            let path = fm.FilePath.substring(fm.FilePath.indexOf("project-files\\") + 14);
            let file = fileInfos.find((fm: any) => fm.path === path);
            let fileDetails = {
                _id: fm._id, pid: fm.ProjectId, fileTypeId: fileType._id, wid: fm.WorkspaceId,
                fileName: fm.FileName, filePath: file.filePath,
                linesCount: fm.LinesCount, processed: true,
                fileNameWithoutExt: fm.FileNameWithoutExt,
                fileStatics: { lineCount: fm.LinesCount, parsed: true, processedLineCount: fm.DoneParsing }
            } as FileMaster;
            await appService.fileMaster.addItem(fileDetails);
        } catch (ex) {
            console.log("Exception", ex);
        }
    }
};
// add workspace master information
const addWorkspace = async (extractPath: string, wmJson: any) => {
    let languageMaster = await appService.languageMaster.getItem({ name: wmJson.LanguageName });
    if (!languageMaster) throw new AppError("Language does not exist", 404, { code: 404, name: wmJson.LanguageName });

    let workspaceMaster = { _id: wmJson._id, name: wmJson.Name, lid: languageMaster._id, description: wmJson.Description, dirPath: extractPath, physicalPath: extractPath } as WorkspaceMaster;
    // add workspace to database and return workspaceMaster
    let workspace = await appService.workspaceMaster.getItem({ name: workspaceMaster.name });
    if (!workspace) {
        let ws = await appService.workspaceMaster.addItem(workspaceMaster);
        workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id: ws._id } }]);
    }
    return workspace;
};
const addProject = async (totalObjects: number, extractPath: string, uploadDetails: any, pmJson: any[], workspace: WorkspaceMaster) => {
    for (const pJson of pmJson) {
        let projectMaster = {
            _id: pJson._id, name: pJson.Name, lid: workspace.lid,
            wid: workspace._id, description: pJson.Description, source: 'utility',
            uploadDetails: uploadDetails, extractedPath: extractPath,
            uploadedPath: uploadDetails.uploadPath, totalObjects: totalObjects,
            processingStatus: ProcessingStatus.processed, uploadedOn: new Date(), processedOn: new Date()
        } as ProjectMaster;
        // add project to database
        let project = await appService.projectMaster.getItem({ name: projectMaster.name });
        if (!project) {
            project = await appService.projectMaster.addItem(projectMaster);
        }
    }
};
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
const projectProcessingStages = async function (pid: Mongoose.Types.ObjectId | string) {
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