import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose, { PipelineStage } from "mongoose";
import { join, resolve } from "path";
import { writeFileSync } from "fs";
import { appService } from "../services/app-service";
import { prepareNodes, prepareDotNetLinks, resetNodeAndLinkIndex, EntityAttributes, EntityMaster, FileContentMaster, FileMaster, LanguageMaster, ProcessingStatus, ProjectMaster, WorkspaceMaster } from "../models";
import { extractProjectZip, Upload, FileExtensions, formatData, readJsonFile, sleep, ConsoleLogger, WinstonLogger } from "nextgen-utilities";
import { existsSync } from "fs";
import { AppError } from "../common/app-error";
import { convertStringToObjectId } from "../helpers";
import { isEmpty, isEqual } from "lodash";
import ProgressBar from "progress";

const pmRouter: Router = Express.Router();
const fileExtensions = new FileExtensions();
const logger: ConsoleLogger = new ConsoleLogger(`controllers - ${__filename}`);
const winstonLogger: WinstonLogger = new WinstonLogger(`controllers - ${__filename}`);

pmRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/docs", async (request: Request, response: Response, next: NextFunction) => {
    let pid: string = <string>request.query.pid;
    let projects = await appService.mongooseConnection.collection("projectMaster").aggregate([
        { $match: { _id: new Mongoose.Types.ObjectId(pid) } },
        { $lookup: { from: "fileMaster", localField: "_id", foreignField: "pid", as: "docs", pipeline: [{ $sort: { fileName: 1 } }] } }
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
}).post("/upload-project", function (request: any, response: Response | any) {
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
}).get("/nodes-and-links/:pid/:wid", async function (request: Request, response: Response) {
    try {
        let pid: string = <string>request.params.pid;
        let wid: string = <string>request.params.wid;
        let projects = await appService.projectMaster.getDocuments({ wid: new Mongoose.Types.ObjectId(wid) }, {}, {}, { _id: 1 });
        if (projects.length === 0) return response.status(404).json({ message: 'Project with provided ID not found' }).end();
        if (projects.length === 1) {
            let nodesAndLinks = await appService.objectConnectivity.getDocuments({ pid: new Mongoose.Types.ObjectId(pid) }, {}, {}, { _id: 1 });
            let { nodes, links } = resetNodeAndLinkIndex(nodesAndLinks.filter((d: any) => d.type === 1), nodesAndLinks.filter((d: any) => d.type === 2));
            // concatenate nodes and links
            nodesAndLinks = nodes.concat(links);
            return response.status(200).json({ data: nodesAndLinks, level: 0 }).end();
        }
        // this is for multiple projects
        let nodesAndLinks = await appService.objectConnectivity.getDocuments({ wid: new Mongoose.Types.ObjectId(wid), image: "system.png" }, {}, {}, { _id: 1 });
        // separate out the nodes and links
        let nodes = nodesAndLinks.filter((d: any) => d.type === 1);
        // set originalIndex for each node
        nodes.forEach((node: any, index: number) => { node.originalIndex = index; });
        let links = nodesAndLinks.filter((d: any) => d.type === 2);
        // for each link, find the source and target nodes and adjust source and target
        links.forEach((link: any) => {
            let sourceIndex = nodes.findIndex((node: any) => node.pid.toString() === link.srcFileId);
            let targetIndex = nodes.findIndex((node: any) => node.pid.toString() === link.tarFileId);
            if (sourceIndex === -1 || targetIndex === -1) return;
            // check if link already exists with same source and target
            let exists = links.find((l: any) => l.source === sourceIndex && l.target === targetIndex);
            if (exists) return;
            link.source = sourceIndex;
            link.target = targetIndex;
        });
        // combine nodes and links into one array
        let data = nodes.concat(links);
        response.status(200).json({ data, level: 0 }).end();
    } catch (error) {
        response.status(500).json({ error }).end();
    }
}).get("/project-nodes-and-links/:pid/:level", async function (request: Request, response: Response) {
    try {
        let pid: string = <string>request.params.pid;
        let project = await appService.projectMaster.findById(pid);
        if (!project) response.status(404).json({ message: 'Project with provided ID not found' }).end();
        var { nodes, links } = await projectInterConnectivity(project);
        response.status(200).json({ nodes, links, level: 'child' }).end();
    } catch (error) {
        response.status(500).json({ error }).end();
    }
}).post("/upload-project-bundle/:pname", async function (request: Request | any, response: Response) {
    try {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        let rootDir = resolve(join(__dirname, "../", "../"));
        let uploadDetails = request.body;
        request.rootDir = rootDir;
        winstonLogger.info(`Upload project bundle request received.`, { code: "UPLOAD_PROJECT_BUNDLE_START", name: request.params.pname });

        function checkWrite(err: any) {
            if (!err) return;
            winstonLogger.error(new Error("Error occurred during extraction"), { code: "EXTRACTION_ERROR", name: request.params.pname, extras: err });
            response.json({ message: "Error occurred during extraction", error: err }).end();
        }
        response.write(formatData({ message: "Starting extraction of project bundle" }), "utf-8", checkWrite);

        await sleep(500);

        extractProjectZip({ uploadDetails: uploadDetails }).then(async (extractPath: string) => {
            winstonLogger.info("Project bundle extracted successfully", { code: "EXTRACTION_SUCCESS", name: request.params.pname });

            response.write(formatData({ message: "Project bundle extracted successfully." }), "utf-8", checkWrite);

            await sleep(1000);
            // response for reading file details from extracted path
            response.write(formatData({ message: "Reading file details from extracted path." }), "utf-8", checkWrite);
            let allFiles = fileExtensions.getAllFilesFromPath(join(extractPath, "project-files"), [], true);

            // read workspace-master.json file from workspace-master folder and create workspace
            // this will work in case of C# language - for now
            let wmJsonPath = join(extractPath, "workspace-master", "workspace-master.json");

            if (!existsSync(wmJsonPath)) {
                winstonLogger.warn("Workspace master JSON not found", { code: "WORKSPACE_JSON_NOT_FOUND", name: request.params.pname });
                response.write(formatData({ message: "Workspace master JSON not found, so using project master JSON for creating workspace." }), "utf-8", checkWrite);
                response.end();
            }

            let readWsJson = await readJsonFile(wmJsonPath);

            if ([500, 404].includes(readWsJson.code)) {
                winstonLogger.error(new Error("Workspace JSON not found"), { code: "WORKSPACE_JSON_NOT_FOUND", name: request.params.pname });
                return response.end(formatData({ message: 'Workspace JSON not found' }));
            }

            let workspace: WorkspaceMaster = undefined;
            if (readWsJson.code === 200) {
                let wJson = readWsJson.data;
                workspace = await addWorkspace(extractPath, wJson);
            }

            let languageMaster = await appService.languageMaster.getItem({ _id: workspace.lid });
            // read project-master.json file from project-master folder and create project
            let pmJsonPath = join(extractPath, "project-master", "project-master.json");
            let readPrJson = await readJsonFile(pmJsonPath);

            if ([500, 404].includes(readPrJson.code)) {
                winstonLogger.error(new Error("Project JSON not found"), { code: "PROJECT_JSON_NOT_FOUND", name: request.params.pname });
                return response.end(formatData({ message: 'Project JSON not found' }));
            }

            if (readPrJson.code === 200) {
                // check if project name is provided in request url params.. if yes, then override in JSON
                let name: string = <string>request.params.pname;
                readPrJson.data.forEach((d: any) => { d.Name = isEmpty(name) ? d.Name : name });
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
                // process for member details
                response.write(formatData({ message: "Started process for adding member references to repository." }), "utf-8", checkWrite);
                await addMemberReference(workspace, netJson.data);
            }
            // process for member-references
            response.write(formatData({ message: "Started processing for member references." }), "utf-8", checkWrite);
            // let dotNetMemberJson = await readJsonFile(join(extractPath, "member-references", "member-references.json"));
            if (netJson.code === 200) {
                // special case for dot net repositories
                await addDotNetMemberReferences(workspace, netJson.data);
            }
            // process for action workflows and workflow connectivities
            // this is only for .NET and similar languages...
            response.write(formatData({ message: "Started process for adding action workflows to repository." }), "utf-8", checkWrite);

            let actionsJson = await readJsonFile(join(extractPath, "action-workflows", "action-workflows.json"));
            if (actionsJson.code === 200) {
                await processActionWorkflows(workspace, actionsJson.data);
            }

            let workConnectJson = await readJsonFile(join(extractPath, "workflow-connectivities", "workflow-connectivities.json"));
            if (workConnectJson.code === 200) {
                await processActionsAndConnectivities(workspace, actionsJson.data, workConnectJson.data);
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
            response.write(formatData({ message: "Started process for adding statement reference details to repository." }), "utf-8", checkWrite);
            let statementReferencesJson: any = await readJsonFile(join(extractPath, "statement-master", "statement-master.json"));
            if (statementReferencesJson.code === 200) {
                await addStatementReferences(workspace, statementReferencesJson.data, (progress: string) => {
                    response.write(formatData({ message: progress }), "utf-8", checkWrite);
                });
            }

            // process for file contents...
            response.write(formatData({ message: "Started processing file contents to repository." }), "utf-8", checkWrite);
            await processFileContents(workspace);

            // process for missing objects
            response.write(formatData({ message: "Started process for missing objects." }));
            let missingJson = await readJsonFile(join(extractPath, "missing-objects", "missing-objects.json"));
            if (missingJson.code === 200) {
                await addMissingObjects(missingJson.data);
            }
            //process for entities
            response.write(formatData({ message: "Started process for getting  entities." }));
            let entityJson = await readJsonFile(join(extractPath, "entity-master", "entity-master.json"));
            if (entityJson.code === 200) {
                await addEntitiesAndAttributes(entityJson.data);
            }

            response.write(formatData({ message: "You can start loading project now." }), "utf-8", checkWrite);
            response.end();
        }).catch((err: any) => {
            winstonLogger.error(new Error("Error during project bundle extraction"), { code: "EXTRACTION_ERROR", name: request.params.pname, extras: { ...err } });
            response.end(formatData(err));
        });
    } catch (error) {
        winstonLogger.error(new Error("Error in upload project bundle"), { code: "UPLOAD_PROJECT_BUNDLE_ERROR", name: request.params.pname, extras: error });
        response.end(formatData(error));
    }
}).get("/reprocess-action-workflows/:wid", async function (request: Request, response: Response) {
    let wid: string = <string>request.params.wid;
    let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id: new Mongoose.Types.ObjectId(wid) } }]);
    if (!workspace) return response.status(404).end();
    let extractPath: string = <string>workspace.dirPath;
    let actionsJson = await readJsonFile(join(extractPath, "action-workflows", "action-workflows.json"));
    let workConnectJson = await readJsonFile(join(extractPath, "workflow-connectivities", "workflow-connectivities.json"));
    if (actionsJson.code === 200 && workConnectJson.code === 200) {
        await processActionWorkflows(workspace, actionsJson.data);
        await processActionsAndConnectivities(workspace, actionsJson.data, workConnectJson.data);
    }
    response.status(200).json({ message: "Network connectivity is regenerated successfully." }).end();
}).get("/reprocess-network-connectivity/:wid", async function (request: Request, response: Response) {
    let wid: string = <string>request.params.wid;
    let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id: new Mongoose.Types.ObjectId(wid) } }]);
    if (!workspace) return response.status(404).end();
    let extractPath: string = <string>workspace.dirPath;
    let networkJson: any = await readJsonFile(join(extractPath, "workflow-connectivities", "workflow-connectivities.json"));
    let actionsJson = await readJsonFile(join(extractPath, "action-workflows", "action-workflows.json"));
    if (networkJson.code === 200) {
        await processActionsAndConnectivities(workspace, actionsJson.data, networkJson.data);
    }
    response.status(200).json({ message: "Network connectivity is regenerated successfully." }).end();
}).get("/reprocess-file-contents/:wid", async function (request: Request, response: Response) {
    let wid: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
    let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id: new Mongoose.Types.ObjectId(wid) } }]);
    if (!workspace) return response.status(404).end();
    await processFileContents(workspace);
    response.status(200).json({ message: "File contents processed successfully." }).end();
}).get("/reprocess-file-details/:wid", async function (request: Request, response: Response) {
    let wid: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
    let workspace = await appService.workspaceMaster.findById(wid);
    if (!workspace) return response.status(404).end();
    let extractPath: string = <string>workspace.dirPath;
    let languageMaster = await appService.languageMaster.getItem({ _id: workspace.lid });
    let allFiles = fileExtensions.getAllFilesFromPath(join(workspace.dirPath, "project-files"));
    let fmJson = await readJsonFile(join(extractPath, "file-master", "file-master.json"));
    if (fmJson.code === 200) {
        await addFileDetails(allFiles, languageMaster, fmJson.data);
    }
    response.status(200).json({ message: "File master details processed successfully" }).end();
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
        winstonLogger.info(`User ${request.user.fullName} has restarted processing of statement masters data.`, { code: 'reprocess-1002', name: 'reprocess-statement-references', extras: { id: request.user._id.toString() } });
        function checkWrite(err: any) {
            if (!err) return;
            winstonLogger.error(new Error("Error occurred during extraction"), { code: "EXTRACTION_ERROR", name: request.params.pname, extras: err });
            response.json({ message: "Error occurred during extraction", error: err }).end();
        }
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        let extractPath: string = <string>workspace.dirPath;
        let statementReferencesJson: any = await readJsonFile(join(extractPath, "statement-master", "statement-master.json"));
        if (statementReferencesJson.code === 200) {
            winstonLogger.info(`There are total: ${statementReferencesJson.data.length} records to process.`);
            await addStatementReferences(workspace, statementReferencesJson.data, (progress: string) => {
                response.write(formatData({ message: progress }), "utf-8", checkWrite);
            });
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
}).get("/reprocess-entity-attributes/:wid", async (request: Request, response: Response) => {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        let extractPath: string = <string>workspace.dirPath;
        let entityJson: any = await readJsonFile(join(extractPath, "entity-master", "entity-master.json"));
        if (entityJson.code === 200) {
            await addEntitiesAndAttributes(entityJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(500).send().end();
    }
}).post("/upload-new-project-bundle/:pname/:wid", async function (request: Request | any, response: Response) {
    try {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        let rootDir = resolve(join(__dirname, "../", "../"));
        let uploadDetails = request.body;
        request.rootDir = rootDir;
        let wid: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        winstonLogger.info(`Upload project bundle request received.`, { code: "UPLOAD_PROJECT_BUNDLE_START", name: request.params.pname });

        function checkWrite(err: any) {
            if (!err) return;
            winstonLogger.error(new Error("Error occurred during extraction"), { code: "EXTRACTION_ERROR", name: request.params.pname, extras: err });
            response.json({ message: "Error occurred during extraction", error: err }).end();
        }
        response.write(formatData({ message: "Starting extraction of project bundle" }), "utf-8", checkWrite);

        await sleep(500);

        extractProjectZip({ uploadDetails: uploadDetails }).then(async (extractPath: string) => {
            winstonLogger.info("Project bundle extracted successfully", { code: "EXTRACTION_SUCCESS", name: request.params.pname });

            response.write(formatData({ message: "Project bundle extracted successfully." }), "utf-8", checkWrite);

            await sleep(1000);
            // response for reading file details from extracted path
            response.write(formatData({ message: "Reading file details from extracted path." }), "utf-8", checkWrite);
            let allFiles = fileExtensions.getAllFilesFromPath(join(extractPath, "project-files"), [], true);

            // read workspace-master.json file from workspace-master folder and create workspace
            // this will work in case of C# language - for now
            let workspace: WorkspaceMaster = await appService.workspaceMaster.getItem({ _id: wid });
            let wmJsonPath = join(extractPath, "workspace-master", "workspace-master.json");

            let readWsJson = await readJsonFile(wmJsonPath);
            if ([500, 404].includes(readWsJson.code)) {
                winstonLogger.error(new Error("Workspace JSON not found"), { code: "WORKSPACE_JSON_NOT_FOUND", name: request.params.pname });
                return response.end(formatData({ message: 'Workspace JSON not found' }));
            }

            let languageMaster: LanguageMaster = undefined;
            if (readWsJson.code === 200) {
                let wJson = readWsJson.data;
                languageMaster = await appService.languageMaster.getItem({ name: wJson.LanguageName });
            }

            await addWorkspaceIntoJson(extractPath, workspace);

            // read project-master.json file from project-master folder and create project
            let pmJsonPath = join(extractPath, "project-master", "project-master.json");
            let readPrJson = await readJsonFile(pmJsonPath);

            if ([500, 404].includes(readPrJson.code)) {
                winstonLogger.error(new Error("Project JSON not found"), { code: "PROJECT_JSON_NOT_FOUND", name: request.params.pname });
                return response.end(formatData({ message: 'Project JSON not found' }));
            }

            if (readPrJson.code === 200) {
                // check if project name is provided in request url params.. if yes, then override in JSON
                let name: string = <string>request.params.pname;
                readPrJson.data.forEach((d: any) => { d.Name = isEmpty(name) ? d.Name : name });
                await addProjectWorkspace(allFiles.length, extractPath, uploadDetails, readPrJson.data, workspace, languageMaster);
            }
            var pid = readPrJson.data[0]._id;
            let project: ProjectMaster = undefined;
            project = await appService.projectMaster.getItem({ _id: pid });
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
                // this will work for COBOL and similar languages...
                // NOTE: this is not needed for any languages now
                // await processNetworkConnectivity(languageMaster, workspace, netJson.data);
                // process for member details
                response.write(formatData({ message: "Started process for adding member references to repository." }), "utf-8", checkWrite);
                await addMemberReferenceWorkspace(workspace, languageMaster, netJson.data);
            }
            // process for member-references
            response.write(formatData({ message: "Started processing for member references." }), "utf-8", checkWrite);
            // let dotNetMemberJson = await readJsonFile(join(extractPath, "member-references", "member-references.json"));
            if (netJson.code === 200) {
                // special case for dot net repositories
                await addDotNetMemberReferences(workspace, netJson.data);
            }
            // process for action workflows and workflow connectivities
            // this is only for .NET and similar languages...
            response.write(formatData({ message: "Started process for adding action workflows to repository." }), "utf-8", checkWrite);

            let actionsJson = await readJsonFile(join(extractPath, "action-workflows", "action-workflows.json"));
            if (actionsJson.code === 200) {
                await processActionWorkflowsWorkspace(workspace, actionsJson.data);
            }

            // process workflow connectivities
            // this is only for .NET and similar languages...
            response.write(formatData({ message: "Started process for workflow connectivities." }), "utf-8", checkWrite);
            let workConnectJson = await readJsonFile(join(extractPath, "workflow-connectivities", "workflow-connectivities.json"));
            if (workConnectJson.code === 200) {
                await processActionsAndConnectivitiesWorkspace(workspace, project, actionsJson.data, workConnectJson.data);
            }

            // process for method details
            response.write(formatData({ message: "Started process for adding method details to repository." }), "utf-8", checkWrite);
            let methodDetailsJson: any = await readJsonFile(join(extractPath, "method-details", "method-details.json"));
            if (methodDetailsJson.code === 200) {
                await addMethodDetailsWorkspace(workspace, methodDetailsJson.data);
            }

            // process for method details
            response.write(formatData({ message: "Started process for adding field and properties details to repository." }), "utf-8", checkWrite);
            let fieldAndPropertiesJson: any = await readJsonFile(join(extractPath, "field-and-properties", "field-and-properties.json"));
            if (fieldAndPropertiesJson.code === 200) {
                await addDotNetFieldAndPropertiesDetailsWorkspace(workspace, fieldAndPropertiesJson.data);
            }

            // process for statement master
            response.write(formatData({ message: "Started process for adding statement reference details to repository." }), "utf-8", checkWrite);
            let statementReferencesJson: any = await readJsonFile(join(extractPath, "statement-master", "statement-master.json"));
            if (statementReferencesJson.code === 200) {
                await addStatementReferencesWorkspace(workspace, statementReferencesJson.data, (progress: string) => {
                    response.write(formatData({ message: progress }), "utf-8", checkWrite);
                });
            }

            // process for file contents...
            response.write(formatData({ message: "Started processing file contents to repository." }), "utf-8", checkWrite);
            await processFileContentsWorkspace(languageMaster);

            // process for missing objects
            response.write(formatData({ message: "Started process for missing objects." }));
            let missingJson = await readJsonFile(join(extractPath, "missing-objects", "missing-objects.json"));
            if (missingJson.code === 200) {
                await addMissingObjects(missingJson.data);
            }

            // process for entities            
            response.write(formatData({ message: "Started process for getting  entities." }));
            let entityJson = await readJsonFile(join(extractPath, "entity-master", "entity-master.json"));
            if (entityJson.code === 200) {
                await addEntitiesAndAttributes(entityJson.data);
            }
            // since at this point, we have added all the details to repository, so we can start processing inter connectivity between projects
            await processProjectInterConnectivity(workspace);

            // process for inter connectivity 
            await processObjectInterConnectivity(workspace);

            response.write(formatData({ message: "You can start loading project now." }), "utf-8", checkWrite);
            response.end();
        }).catch((err: any) => {
            winstonLogger.error(new Error("Error during project bundle extraction"), { code: "EXTRACTION_ERROR", name: request.params.pname, extras: { ...err } });
            response.end(formatData(err));
        });
    } catch (error) {
        winstonLogger.error(new Error("Error in upload project bundle"), { code: "UPLOAD_PROJECT_BUNDLE_ERROR", name: request.params.pname, extras: error });
        response.end(formatData(error));
    }
}).get("/reprocess-inter-connectivity/:wid", async (request: Request, response: Response) => {
    try {
        let wid: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.getItem({ _id: wid });
        await processProjectInterConnectivity(workspace);
        await processObjectInterConnectivity(workspace);
        response.status(200).json().end();
    } catch (error) {
        response.status(500).send().end();
    }
});

const addEntitiesAndAttributes = async function (entityJson: any[]) {
    try {
        let allowedFields = ["entityName", "attributes"];
        let allowedAttributeFields = ["attributeName", "dataType", "dataLength"];
        for (const element of entityJson) {
            let entity: EntityMaster = {
                entityName: element.entityName,
                fid: Mongoose.Types.ObjectId.createFromHexString(element.fid),
                pid: Mongoose.Types.ObjectId.createFromHexString(element.pid),
                type: element.type
            } as EntityMaster;

            let em = await appService.entityMaster.addItem(entity);
            if (element.entityName === "None") {
                let variableDetails = {
                    type: "Variable & Data Element",
                    promptId: 1001,
                    fid: Mongoose.Types.ObjectId.createFromHexString(element.fid),
                    data: "None",
                    formattedData: "None",
                    genAIGenerated: false
                } as any;
                await appService.mongooseConnection.collection("businessSummaries").insertOne(variableDetails);
                continue;
            }
            let attributes = element.attributes || [];
            if (attributes.length === 0) continue;
            for (const attr of attributes) {
                let attribute: EntityAttributes = {
                    pid: Mongoose.Types.ObjectId.createFromHexString(attr.pid),
                    fid: Mongoose.Types.ObjectId.createFromHexString(attr.fid),
                    eid: em._id,
                    entityName: element.entityName,
                    attributeName: attr.attributeName,
                    dataLength: attr.dataLength,
                    dataType: attr.dataType,
                    storeEntitySet: attr.storeEntitySet
                } as EntityAttributes;
                await appService.entityAttributes.addItem(attribute);
            }
            let filteredObj = Object.keys(element)
                .filter(key => allowedFields.includes(key)) // Keep only allowed fields
                .reduce((acc: any, key) => {
                    acc[key] = element[key];
                    return acc;
                }, {});
            if (filteredObj.attributes && Array.isArray(filteredObj.attributes)) {
                filteredObj.attributes = filteredObj.attributes.map((attr: any) =>
                    Object.keys(attr)
                        .filter(key => allowedAttributeFields.includes(key))
                        .reduce((acc: any, key) => {
                            acc[key] = attr[key];
                            return acc;
                        }, {})
                );
            }
            let variableDetails = {
                type: "Variable & Data Element",
                promptId: 1001,
                fid: Mongoose.Types.ObjectId.createFromHexString(element.fid),
                data: JSON.stringify(filteredObj),
                formattedData: JSON.stringify(filteredObj),
                genAIGenerated: false
            } as any;
            await appService.mongooseConnection.collection("businessSummaries").insertOne(variableDetails);
        }
    } catch (error) {
        throw error;
    }
};
const addStatementReferences = async function addStatementReferences(wm: WorkspaceMaster, statementMastersJson: any[], callback: Function): Promise<any> {
    try {
        let collection = appService.mongooseConnection.collection("statementMaster");
        await collection.deleteMany({ wid: wm._id });
        statementMastersJson.filter((d) => isEmpty(d.wid)).forEach((d) => d.wid = wm._id);
        let modifiedStatementMasters = convertStringToObjectId(statementMastersJson);
        const totalRecords = modifiedStatementMasters.length;
        let bar: ProgressBar = logger.showProgress(totalRecords);
        // we'll report back progress, as this is time consuming process
        // we'll report progress in batch of 30 records        
        callback(`There are total ${totalRecords} records to process into repository.`);
        let counter: number = 0;
        let lastProgress: number = 0;
        for (const statementMaster of modifiedStatementMasters) {
            await collection.insertOne(statementMaster);
            ++counter;
            const currentProgress = Math.floor((counter * 100) / totalRecords / 10) * 10;
            if (currentProgress > lastProgress) {
                bar.tick({ done: counter, length: totalRecords });
                const progress = `Added ${currentProgress}% records to repository successfully...`;
                callback(progress);
                lastProgress = currentProgress;
            }
        }
        bar.terminate();
    } catch (error) {
        console.log(error);
    }
};
const addDotNetFieldAndPropertiesDetails = async function addDotNetFieldAndPropertiesDetails(wm: WorkspaceMaster, fieldAndPropertiesJson: any[]): Promise<any> {
    try {
        if (!(wm.languageMaster.name === "C#")) return;
        let collection = appService.mongooseConnection.collection("fieldAndPropertiesDetails");
        await collection.deleteMany({ wid: wm._id });
        let modifiedFieldAndProperties = convertStringToObjectId(fieldAndPropertiesJson);
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
        let modifiedReferences = convertStringToObjectId(memberReferencesJson);
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
        let modifiedMethodDetails = convertStringToObjectId(methodDetailsJson);
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
                fid: m._id,
                pid: Mongoose.Types.ObjectId.createFromHexString(m.ProjectId),
                wid: Mongoose.Types.ObjectId.createFromHexString(m.WorkspaceId),
                fileName: m.WorkFlowStatus,
                fileTypeName: m.FileType,
                missingObjectType: m.FileType,
                missingFileName: m.FileName,
                statement: m.SourceFilePath
            } as any;
            await appService.mongooseConnection.collection("missingObjects").insertOne(missingObjDetail);
        }
    } catch (error) {
        console.log(error);
    }
};
const processFileContents = async (wm: WorkspaceMaster) => {
    try {
        let projects = await appService.projectMaster.getDocuments({ wid: wm._id });
        for (const project of projects) {
            let collection = appService.fileContentMaster.getModel();
            await collection.deleteMany({ pid: project._id });
            let allFiles = await appService.fileMaster.aggregate([{ $match: { pid: project._id } }]);
            for (let file of allFiles) {
                // in case of COBOL, PLSQL, Assembler language, we need to store sourceFilePath (original) contents as original 
                // and filePath contents are modified. We'll as this field only in case of COBOL
                const languagesToRead = ["COBOL", "PLSQL", "Assembler"];
                let path = languagesToRead.includes(wm.languageMaster.name) ? file.sourceFilePath : file.filePath;
                const content = fileExtensions.readTextFile(path);
                if (!content) continue;
                // if COBOL then read filePath's contents and store this as modified
                let modified = languagesToRead.includes(wm.languageMaster.name) ? fileExtensions.readTextFile(file.filePath) : "";
                let fcm = { fid: file._id, pid: file.pid, original: content, formatted: modified } as FileContentMaster;
                if (isEmpty(modified)) delete fcm.formatted;
                await appService.fileContentMaster.addItem(fcm);
            }
        }
    }
    catch (error) {
        console.log(error);
    }
};
const processActionWorkflows = async function processActionWorkflows(wm: WorkspaceMaster, actionsJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("actionWorkflows");
        await collection.deleteMany({ wid: wm._id });
        let actionWorkflows = convertStringToObjectId(actionsJson);
        for (let aw of actionWorkflows) {
            await collection.insertOne(aw);
        }
    }
    catch (ex) {
        console.log("Exception", ex);
    }
};
const processActionsAndConnectivities = async function processActionsAndConnectivities(wm: WorkspaceMaster, actionsJson: any[], connectivityJson: any[]) {
    // from actionsJson we'll prepare nodes
    let allFiles = await appService.fileMaster.aggregate([{ $match: { wid: wm._id } }]);
    var networkFiles: any[] = [];
    actionsJson.forEach((aw) => {
        let file = allFiles.find((d) => d._id.toString() === aw.fid.toString());
        networkFiles.push({ ...file, aid: aw._id, fileName: aw.methodName });
    });
    let nodes = prepareNodes(networkFiles);
    let links = prepareDotNetLinks(connectivityJson);
    let collection = appService.mongooseConnection.collection("objectConnectivity");
    await collection.deleteMany({ wid: wm._id });
    let updatedNodes = convertStringToObjectId(nodes);
    for (let node of updatedNodes) {
        await collection.insertOne(node);
    }
    for (let link of links) {
        await collection.insertOne(link);
    }
};
const addMemberReference = async (wm: WorkspaceMaster, memberRefJson: any[]) => {
    if (wm.languageMaster.name === "C#") return;

    try {
        let collection = appService.mongooseConnection.collection("memberReferences");
        // remove existing member references for the workspace
        await collection.deleteMany({ wid: wm._id });
        for (const member of memberRefJson) {
            let fileType = await appService.fileTypeMaster.getItem({ fileTypeName: { $regex: new RegExp(`^${member.FileTypeName}$`, 'i') } });
            let callExts: Array<any> = [];
            for (const ce of member.CallExternals) {
                callExts.push({
                    fid: Mongoose.Types.ObjectId.isValid(ce._id) ? Mongoose.Types.ObjectId.createFromHexString(ce._id) : 0,
                    fileName: ce.FileName,
                    callExternals: ce.CallExternals,
                    wid: Mongoose.Types.ObjectId.createFromHexString(member.WorkspaceId),
                    fileTypeName: ce.FileTypeName,
                    pid: Mongoose.Types.ObjectId.createFromHexString(member.ProjectId),
                    missing: ce.Missing === 0 ? false : true,
                    location: 0, methodNo: 0
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
                methodNo: 0,
                location: 0,
                callExternals: callExts
            } as any;
            await appService.mongooseConnection.collection("memberReferences").insertOne(memberDetails);
        }
    } catch (ex) {
        console.log("Exception", ex);
    }
};
const addFileDetails = async (allFiles: string[], lm: LanguageMaster, fileMasterJson: any[]) => {
    const fileTypeMaster = await appService.fileTypeMaster.getDocuments({ lid: lm._id });
    // Normalize path extraction for Windows paths
    const normalizeWindowsPath = (filePath: string) => {
        // Handle both Windows and potential mixed path separators
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^[a-zA-Z]:/, '');
        // Extract path after 'project-files'
        const projectFilesIndex = normalizedPath.toLowerCase().indexOf('project-files');
        return projectFilesIndex !== -1 ? normalizedPath.substring(projectFilesIndex + 13) : normalizedPath;
    };
    // Prepare file infos with normalized paths
    let fileInfos = allFiles.map((file) => {
        let info = fileExtensions.getFileInfo(file);
        // Normalize the path extraction
        let path = normalizeWindowsPath(file);
        return { ...info, filePath: file, path };
    });

    for (const fm of fileMasterJson) {
        try {
            let path = normalizeWindowsPath(fm.FilePath);
            // Find the matching file with normalized path
            let file = fileInfos.find((fileInfo: any) => fileInfo.path.toLowerCase() === path.toLowerCase());
            // If file not found, try more flexible matching
            if (!file) {
                const fileName = path.split('/').pop();
                file = fileInfos.find((fileInfo: any) => fileInfo.path.toLowerCase().endsWith(fileName.toLowerCase()));
            }
            // Throw error if still no file found
            if (!file) {
                throw new Error(`File not found for path: ${path}`);
            }

            let fileType = fileTypeMaster.find((ftm: any) => ftm.fileTypeName.toLowerCase() === fm.FileTypeName.toLowerCase() && ftm.fileTypeExtension.toLowerCase() === fm.FileTypeExtension.toLowerCase());
            let fileDetails = {
                _id: fm._id, pid: fm.ProjectId, fileTypeId: fileType._id,
                wid: fm.WorkspaceId, fileName: fm.FileName, filePath: file.filePath,
                linesCount: fm.LinesCount, processed: true,
                sourceFilePath: file.filePath.replace(/project-files/ig, "original-files"),
                fileNameWithoutExt: fm.FileNameWithoutExt,
                fileStatics: { lineCount: fm.LinesCount, parsed: true, processedLineCount: fm.DoneParsing, commentedLines: fm.CommentedLines }
            } as FileMaster;

            await appService.fileMaster.addItem(fileDetails);
        } catch (ex) {
            console.error("Exception processing file:", ex);
            // Optionally log the specific file that caused the error
            console.error("Problematic file:", fm.FilePath);
        }
    }
};
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
const addProjectWorkspace = async (totalObjects: number, extractPath: string, uploadDetails: any, pmJson: any[], workspace: WorkspaceMaster, lm: LanguageMaster) => {
    for (const pJson of pmJson) {
        let projectMaster = {
            _id: pJson._id, name: pJson.Name, lid: lm._id,
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
const addStatementReferencesWorkspace = async function addStatementReferencesWorkspace(wm: WorkspaceMaster, statementMastersJson: any[], callback: Function): Promise<any> {
    try {
        let collection = appService.mongooseConnection.collection("statementMaster");
        // await collection.deleteMany({ wid: wm._id });
        statementMastersJson.filter((d) => isEmpty(d.wid)).forEach((d) => d.wid = wm._id);
        let modifiedStatementMasters = convertStringToObjectId(statementMastersJson);
        const totalRecords = modifiedStatementMasters.length;
        let bar: ProgressBar = logger.showProgress(totalRecords);
        // we'll report back progress, as this is time consuming process
        // we'll report progress in batch of 30 records        
        callback(`There are total ${totalRecords} records to process into repository.`);
        let counter: number = 0;
        let lastProgress: number = 0;
        for (const statementMaster of modifiedStatementMasters) {
            await collection.insertOne(statementMaster);
            ++counter;
            const currentProgress = Math.floor((counter * 100) / totalRecords / 10) * 10;
            if (currentProgress > lastProgress) {
                bar.tick({ done: counter, length: totalRecords });
                const progress = `Added ${currentProgress}% records to repository successfully...`;
                callback(progress);
                lastProgress = currentProgress;
            }
        }
        bar.terminate();
    } catch (error) {
        console.log(error);
    }
};
const addMemberReferenceWorkspace = async (wm: WorkspaceMaster, lm: LanguageMaster, memberRefJson: any[]) => {
    if (lm.name === "C#") return;
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
                    missing: ce.Missing === 0 ? false : true
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
                methodNo: 0,
                location: 0,
                callExternals: callExts
            } as any;
            await appService.mongooseConnection.collection("memberReferences").insertOne(memberDetails);
        } catch (ex) {
            console.log("Exception", ex);
        }
    }
};
const processActionWorkflowsWorkspace = async function processActionWorkflowsWorkspace(wm: WorkspaceMaster, actionsJson: any[]) {
    let collection = appService.mongooseConnection.collection("actionWorkflows");
    let actionWorkflows = convertStringToObjectId(actionsJson);
    for (let aw of actionWorkflows) {
        await collection.insertOne(aw);
    }
};
const processActionsAndConnectivitiesWorkspace = async function processActionsAndConnectivitiesWorkspace(wm: WorkspaceMaster, pm: ProjectMaster, actionsJson: any[], connectivityJson: any[]) {
    // from actionsJson we'll prepare nodes
    let collection = appService.mongooseConnection.collection("objectConnectivity");
    let allFiles = await appService.fileMaster.aggregate([{ $match: { wid: wm._id } }]);
    var networkFiles: any[] = [];
    actionsJson.forEach((aw) => {
        let file = allFiles.find((d) => d._id.toString() === aw.fid.toString());
        networkFiles.push({ ...file, fileName: aw.methodName });
    });
    let nodes = prepareNodes(networkFiles);
    let links = prepareDotNetLinks(connectivityJson);
    let updatedNodes = convertStringToObjectId(nodes);
    for (let node of updatedNodes) {
        await collection.insertOne(node);
    }
    for (let link of links) {
        await collection.insertOne(link);
    }
};
const addMethodDetailsWorkspace = async function addMethodDetails(wm: WorkspaceMaster, methodDetailsJson: any[]): Promise<any> {
    try {
        let collection = appService.mongooseConnection.collection("methodDetails");
        let modifiedMethodDetails = convertStringToObjectId(methodDetailsJson);
        for (const methodDetails of modifiedMethodDetails) {
            await collection.insertOne(methodDetails);
        }
    } catch (error) {
        console.log(error);
    }
};
const processFileContentsWorkspace = async (lm: LanguageMaster) => {
    try {
        let projects = await appService.projectMaster.getDocuments({ lid: lm._id });
        for (const project of projects) {
            let collection = appService.fileContentMaster.getModel();
            let allFiles = await appService.fileMaster.aggregate([{ $match: { pid: project._id } }]);
            for (let file of allFiles) {
                // in case of COBOL, PLSQL, Assembler language, we need to store sourceFilePath (original) contents as original 
                // and filePath contents are modified. We'll as this field only in case of COBOL
                const languagesToRead = ["COBOL", "PLSQL", "Assembler"];
                let path = languagesToRead.includes(lm.name) ? file.sourceFilePath : file.filePath;
                const content = fileExtensions.readTextFile(path);
                if (!content) continue;
                // if COBOL then read filePath's contents and store this as modified
                let modified = languagesToRead.includes(lm.name) ? fileExtensions.readTextFile(file.filePath) : "";
                let fcm = { fid: file._id, pid: file.pid, original: content, formatted: modified } as FileContentMaster;
                if (isEmpty(modified)) delete fcm.formatted;
                await appService.fileContentMaster.addItem(fcm);
            }
        }
    }
    catch (error) {
        console.log(error);
    }
};
const addDotNetFieldAndPropertiesDetailsWorkspace = async function addDotNetFieldAndPropertiesDetailsWorkspace(wm: WorkspaceMaster, fieldAndPropertiesJson: any[]): Promise<any> {
    try {
        if (!(wm.languageMaster.name === "C#")) return;
        let collection = appService.mongooseConnection.collection("fieldAndPropertiesDetails");
        let modifiedFieldAndProperties = convertStringToObjectId(fieldAndPropertiesJson);
        for (const fieldAndProperty of modifiedFieldAndProperties) {
            await collection.insertOne(fieldAndProperty);
        }
    } catch (error) {
        console.log(error);
    }
};
const addWorkspaceIntoJson = async (extractPath: string, workspace: WorkspaceMaster) => {
    const files = [
        "project-master/project-master.json",
        "file-master/file-master.json",
        "member-references/member-references.json",
        "action-workflows/action-workflows.json",
        "method-details/method-details.json",
        "field-and-properties/field-and-properties.json",
        "statement-master/statement-master.json",
        "missing-objects/missing-objects.json",
        "entity-master/entity-master.json",
        "workflow-connectivities/workflow-connectivities.json"
    ];

    for (const file of files) {
        try {
            const filePath = join(extractPath, file);
            let jsonData = await readJsonFile(filePath);

            if ([500, 404].includes(jsonData.code)) {
                winstonLogger.error(new Error(`${file} JSON not found`), { code: "JSON_NOT_FOUND", name: file });
            }
            if (file === "statement-master/statement-master.json") {
                jsonData.data.forEach((d: Record<string, any>) => { d.wid = workspace._id; });
            } else {
                jsonData.data.forEach((d: Record<string, any>) => { d.wid = workspace._id; d.WorkspaceId = workspace._id; });
            }
            writeFileSync(filePath, JSON.stringify(jsonData.data, null, 2), "utf-8");
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }
};
const processProjectInterConnectivity = async (wm: WorkspaceMaster) => {
    try {
        // get collection object connectivity
        var collection = appService.mongooseConnection.collection("objectConnectivity");
        // first we need to get all the projects which are in workspace
        var projects = await appService.projectMaster.getDocuments({ wid: wm._id });
        // then we need to get all the projects which are already in object connectivity
        var existingProjects = await appService.objectConnectivity.getDocuments({ wid: wm._id, image: "system.png" });
        // then we need to filter out the projects which are already in object connectivity
        var filteredProjects = projects.filter((p) => !existingProjects.some((ep) => ep.pid.toString() === p._id.toString()));
        // then we need to add the projects which are not in object connectivity
        for (const pm of filteredProjects) {
            var projectNode = { name: pm.name, group: 0, level: 0, image: "system.png", pid: pm._id, wid: wm._id, type: 1 };
            await collection.insertOne(projectNode);
        }
    }
    catch (error) {
        winstonLogger.error(new Error("Error in adding projects nodes into object connectivity"), { code: "ADD_PROJECTS_NODES_ERROR", name: wm.name, extras: error });
    }
};
const processObjectInterConnectivity = async (wm: WorkspaceMaster) => {
    try {
        var missingObjects = await appService.mongooseConnection.collection("missingObjects").aggregate([{ $match: { wid: wm._id } }]).toArray();
        let pipeLine: Array<PipelineStage> = [
            { $match: { wid: wm._id } },
            { $lookup: { from: 'fileMaster', localField: 'fid', foreignField: '_id', as: 'fileMaster' } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster" } },
            { $lookup: { from: 'fileTypeMaster', localField: 'fileTypeId', foreignField: '_id', as: 'fileMaster.fileTypeMaster' } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster.fileTypeMaster" } }
        ];
        let collection = appService.mongooseConnection.collection("objectConnectivity");
        const fileMasters = await appService.fileMaster.aggregate(pipeLine);
        var objectConnectivity = await appService.objectConnectivity.aggregate([{ $match: { wid: wm._id } }]);
        const links: any[] = [];
        let projectLinks: any[] = [];
        for (const mo of missingObjects) {
            const fileTypes = mo.missingObjectType === "COBOL" ? ["COBOL", "ASM File"] : [mo.missingObjectType];
            var missingFile = Array.isArray(fileMasters) ? fileMasters.find(d => d.fileNameWithoutExt === mo.missingFileName && (Array.isArray(d.fileTypeMaster) ? d.fileTypeMaster.some(ft => fileTypes.includes(ft.fileTypeName)) : fileTypes.includes(d.fileTypeMaster?.fileTypeName))) : undefined;
            if (!missingFile) continue;
            var sourceNode = objectConnectivity.find((d) => d?.fileId?.toString() === mo?.fid?.toString() && d?.name === mo?.fileName);
            var targetNode = objectConnectivity.find((d) => d?.fileId?.toString() === missingFile?._id?.toString() && d?.name === missingFile?.fileName);
            if (!sourceNode || !targetNode) continue;
            var sPid = sourceNode.pid?.toString();
            var tPid = targetNode.pid?.toString();
            if (!isEqual(sPid, tPid)) {
                var projectLink = { image: 'system.png', wid: mo.wid, pid: mo.pid, source: sPid, target: tPid, weight: 3, linkText: '', type: 2, srcFileId: sPid, tarFileId: tPid };
                projectLinks.push(projectLink);
            }
            var link = {
                wid: wm._id,
                pid: mo.pid,
                weight: 3,
                srcFileId: sourceNode.fileId,
                tarFileId: targetNode.fileId,
                linkText: mo.missingFileName,
                type: 2
            };
            links.push(link);
        }
        // add project links to object connectivity
        for (let link of projectLinks) {
            var existLink = objectConnectivity.find((d) => d.source === link.source.toString() && d.target === link.target.toString() && d.type === 2);
            if (existLink) continue;
            await collection.insertOne(link);
        }
        // add links to object connectivity
        for (let link of links) {
            var existLink = objectConnectivity.find((d) => d.source === link.srcFileId.toString() && d.target === link.tarFileId.toString() && d.type === 2);
            if (existLink) continue;
            await collection.insertOne(link);
        }
    } catch (error) {
        console.log(error);
    }
};
const projectInterConnectivity = async (pm: ProjectMaster) => {
    try {
        var objectConnectivity = await appService.objectConnectivity.aggregate([{ $match: { wid: pm.wid, image: { $ne: 'system.png' } } }]);
        var allNodes = objectConnectivity.filter((d) => d.type === 1 && d.pid.toString() === pm._id.toString());
        // get all links for nodes in which srcFileId and tarFileId are in allNodes
        var allLinks = objectConnectivity.filter((d) => d.type === 2 && (allNodes.some((n) => n.fileId.toString() === d.srcFileId.toString() || n.fileId.toString() === d.tarFileId.toString())));
        // now get all nodes from objectConnectivity where fileId is either in srcFileId or tarFileId and type is 1
        var finalNodes = objectConnectivity.filter((d) => d.type === 1 && (allLinks.some((l) => l.srcFileId.toString() === d.fileId.toString() || l.tarFileId.toString() === d.fileId.toString())));
        // we need to add again all those nodes which are not in finalNodes but in allNodes
        allNodes.forEach((d) => {
            if (finalNodes.some((n) => n._id.toString() === d._id.toString())) return;
            finalNodes.push(d);
        });
        // set originalIndex for finalNodes
        finalNodes.forEach((d, i) => d.originalIndex = i);
        // now prepare links with source and target as fileId
        let links: any[] = [];
        allLinks.forEach((d) => {
            let sourceNode = finalNodes.find((n) => n.fileId.toString() === d.srcFileId.toString());
            let targetNode = finalNodes.find((n) => n.fileId.toString() === d.tarFileId.toString());
            if (!sourceNode || !targetNode) return;
            links.push({ source: sourceNode.originalIndex, target: targetNode.originalIndex, weight: d.weight, linkText: d.linkText, type: 2 });
        });
        return { nodes: finalNodes, links: links };
    } catch (error) {
        console.log(error);
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
const removeExtension = function (fileName: string) {
    try {
        if (!fileName) return fileName;
        var fileNameWithoutExt = fileName.split('.').slice(0, -1).join('.');
        return fileNameWithoutExt;
    } catch (error) {
        console.log(error);
    }
}
module.exports = pmRouter;