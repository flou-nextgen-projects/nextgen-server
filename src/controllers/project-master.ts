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
import { filter, isEmpty, isEqual } from "lodash";
import ProgressBar from "progress";
import { adjustLinks, filterNodes } from "../models/nodes-and-links";

const pmRouter: Router = Express.Router();
const fileExtensions = new FileExtensions();
const logger: ConsoleLogger = new ConsoleLogger(`controllers - ${__filename}`);
const winstonLogger: WinstonLogger = new WinstonLogger(`controllers - ${__filename}`);

pmRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/docs", async (request: Request, response: Response, next: NextFunction) => {
    let pid: string = <string>request.query.pid;
    let workspaces = await appService.workspaceMaster.aggregate([
        { $match: { _id: new Mongoose.Types.ObjectId(pid) } },
        { $lookup: { from: "fileMaster", localField: "_id", foreignField: "wid", as: "docs", pipeline: [{ $sort: { fileName: 1 } }] } }
    ]);
    let workspace = workspaces.shift();
    response.status(200).json(workspace).end();
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
}).get("/get-all-projects", async function (request: Request, response: Response) {
    let filter = JSON.parse(<string>request.query.filter || null) || null;
    let $pipeLine = !filter ? [] : [{ $match: filter }];
    var projectMaster: Array<ProjectMaster> = await appService.projectMaster.aggregate($pipeLine);
    response.status(200).json(projectMaster).end();
}).get("/get-all", async function (request: Request, response: Response) {
    var userMaster: any = (await appService.userMaster.aggregate([{ $match: { _id: new Mongoose.Types.ObjectId(request.user._id) } }])).shift();
    var match: any = { $match: { _id: { $in: userMaster.workspaces } } };
    let collection = appService.mongooseConnection.collection("fileMaster");
    let pipeLine = [{ $group: { _id: "$wid", totalObjects: { $sum: 1 } } },
    { $lookup: { from: "workspaceMaster", localField: "_id", foreignField: "_id", as: "workspace" } },
    { $unwind: "$workspace" },
    { $lookup: { from: "languageMaster", localField: "workspace.lid", foreignField: "_id", as: "languageMaster" } },
    { $unwind: "$languageMaster" },
    { $project: { uploadedOn: "$workspace.uploadedOn", processedOn: "$workspace.processedOn", languageMaster: "$languageMaster", _id: "$workspace._id", workspaceId: "$_id", name: "$workspace.name", workspace: "$workspace", totalObjects: "$totalObjects", processingStatus: { $literal: 2 } } },
    { $setWindowFields: { sortBy: { _id: -1 }, output: { seqNo: { $documentNumber: {} } } } },
    ];
    if (userMaster.roleMaster.roleName !== "admin") {
        pipeLine.push(match);
    }
    var workspaces = await collection.aggregate(pipeLine).toArray();
    response.status(200).json(workspaces).end();
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
}).get("/project-nodes-and-links/:pid", async function (request: Request, response: Response) {
    try {
        let pid: string = <string>request.params.pid;
        let project = await appService.projectMaster.getItem({ _id: new Mongoose.Types.ObjectId(pid) });
        if (!project) return response.status(404).json({ message: 'Project with provided ID not found' }).end();
        let allLinkDetails = await appService.linkDetails.getDocuments({ wid: project.wid, type: { $in: [1, 2] } }, {}, {});
        let linkDetails = await appService.linkDetails.getDocuments({ pid: project._id, type: { $in: [1, 2] } }, {}, { _id: 1 });
        let nodeDetails = await appService.nodeDetails.getDocuments({ wid: project.wid, alternateName: { $ne: "csproj" }, type: { $ne: 3 } }, {});

        var allNodes = nodeDetails.filter((d) => d.type === 1 && d.pid.toString() === pid);
        // get all links for nodes in which srcFileId and tarFileId are in allNodes
        var allLinks = allLinkDetails.filter((d) => d.type === 2 && (allNodes.some((n) => n.methodId.toString() === d.sourceId.toString() || n.methodId.toString() === d.targetId.toString())));
        // now get all nodes from objectConnectivity where fileId is either in srcFileId or tarFileId and type is 1
        var finalNodes = nodeDetails.filter((d) => d.type === 1 && (allLinks.some((l) => l.sourceId.toString() === d.methodId.toString() || l.targetId.toString() === d.methodId.toString())));
        // we need to add again all those nodes which are not in finalNodes but in allNodes
        allNodes.forEach((d) => {
            if (finalNodes.some((n) => n._id.toString() === d._id.toString())) return;
            finalNodes.push(d);
        });


        let nodes = filterNodes(finalNodes, allLinks);
        let links: any = adjustLinks(nodes, allLinks);
        for (let node of finalNodes) { node.name = node.methodName; }
        response.status(200).json({ data: { nodes, links }, graphLevel: 0 }).end();
    } catch (error) {
        response.status(500).json({ data: [] }).end();
    }
}).get("/nodes-and-links/:wid", async function (request: Request, response: Response) {
    try {
        let wid: string = <string>request.params.wid;
        // we'll first select all projects for workspace, and if there is only one project, then we'll get the details for that project
        let projects = await appService.projectMaster.aggregate([
            { $match: { wid: new Mongoose.Types.ObjectId(wid) } },
            /*
            { $lookup: { from: "actionWorkflows", localField: "_id", foreignField: "pid", as: "workflows" } },
            { $addFields: { workflowsCount: { $size: "$workflows" } } },
            { $set: { hasWorkflows: { $cond: { if: { $gt: [{ $size: "$workflows" }, 0] }, then: true, else: false } } } },
            { $project: { workflows: 0 } }
            */
        ]);
        // let projects = await appService.projectMaster.getDocuments({ wid: new Mongoose.Types.ObjectId(wid) });
        if (projects.length === 0) return response.status(404).json({ message: 'Project with provided ID not found' }).end();
        if (projects.length === 1) {
            let project = projects.shift();
            let nodeDetails = await appService.nodeDetails.getDocuments({ pid: project._id }, {}, {}, { _id: 1 });
            let linkDetails = await appService.linkDetails.getDocuments({ pid: project._id }, {}, {}, { _id: 1 });
            let links = adjustLinks(nodeDetails, linkDetails);
            return response.status(200).json({ data: { nodes: nodeDetails, links }, graphLevel: 0 }).end();
        }
        // since there are multiple projects, we'll prepare nodes and links for all projects
        // let nodes = projects.map(function (p: ProjectMaster) { return { ...p, name: p.name, pid: p._id, wid: p.wid, image: "csharp.png", type: 1 }; });
        // let projectIds = projects.map(function (p: ProjectMaster) { return p._id; });
        let linkDetails = await appService.linkDetails.getDocuments({ wid: new Mongoose.Types.ObjectId(wid), type: 4 }, {}, {}, { _id: 1 });
        let nodeDetails = await appService.nodeDetails.aggregate([
            { $match: { wid: new Mongoose.Types.ObjectId(wid), alternateName: "csproj" } },
            { $lookup: { from: "nodeDetails", let: { pidVal: "$pid" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$pid", "$$pidVal"] }, { $ne: ["$alternateName", "csproj"] }] } } }], as: "nonCsprojDocs" } },
            { $addFields: { workflowsCount: { $size: "$nonCsprojDocs" }, hasWorkflows: { $gt: [{ $size: "$nonCsprojDocs" }, 0] } } },
            { $project: { nonCsprojDocs: 0 } }
        ]);
        // let nodeDetails = await appService.nodeDetails.getDocuments({ wid: new Mongoose.Types.ObjectId(wid), group: 3 }, {}, {}, { _id: 1 });
        for (let node of nodeDetails) { node.name = node.methodName; }
        let links = adjustLinks(nodeDetails, linkDetails);
        response.status(200).json({ data: { nodes: nodeDetails, links }, graphLevel: 1 }).end();
    } catch (error) {
        response.status(500).json({ data: [] }).end();
    }
}).post("/upload-project-bundle/:pname", async function (request: Request | any, response: Response) {
    try {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
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

            // get updated file-master data
            let readUpdatedFmJson = await readJsonFile(join(extractPath, "updated-file-master", "file-master.json"));
            if (readUpdatedFmJson.code === 200) {
                response.write(formatData({ message: "Started adding updated file master details to repository." }), "utf-8", checkWrite);
                await addFileDetails(allFiles, languageMaster, readUpdatedFmJson.data);
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

            // process for workflow connectivities
            response.write(formatData({ message: "Started process for adding workflow connectivities to repository." }), "utf-8", checkWrite);
            let workConnectJson = await readJsonFile(join(extractPath, "workflow-connectivities", "workflow-connectivities.json"));
            if (workConnectJson.code === 200) {
                await processActionsAndConnectivities(workspace, actionsJson.data, workConnectJson.data);
            }

            // process for node details
            response.write(formatData({ message: "Started process for adding node details to the repository." }), "utf-8", checkWrite);
            let nodeDetailsJson = await readJsonFile(join(extractPath, "node-details", "node-details.json"));
            if (nodeDetailsJson.code === 200) {
                await addNodeDetails(workspace, nodeDetailsJson.data);
            }

            // process for link details
            response.write(formatData({ message: "Started process for adding link details to the repository." }), "utf-8", checkWrite);
            let linkDetailsJson = await readJsonFile(join(extractPath, "link-details", "link-details.json"));
            if (nodeDetailsJson.code === 200) {
                await addLinkDetails(workspace, linkDetailsJson.data);
            }

            // process for method details
            response.write(formatData({ message: "Started process for adding method details to repository." }), "utf-8", checkWrite);
            let methodDetailsJson: any = await readJsonFile(join(extractPath, "method-details", "method-details.json"));
            if (methodDetailsJson.code === 200) {
                await addMethodDetails(workspace, methodDetailsJson.data);
            }

            // process for method details
            // this is special case for dot net repositories
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

            // these are additional details for statement references
            // this is for dotnet and similar languages only
            response.write(formatData({ message: "Started process for additional statement references to repository." }), "utf-8", checkWrite);
            let expandedWorkflowFiles = fileExtensions.getAllFilesFromPath(join(extractPath, "", "expanded-workflows"), [], true);
            if (expandedWorkflowFiles.length > 0) {
                for (const ew of expandedWorkflowFiles) {
                    console.log("Expanded workflow file: ", ew);
                    let workflowJson = await readJsonFile(ew);
                    if (workflowJson.code === 200 && workflowJson.data.length > 0) {
                        await addStatementReferences(workspace, workflowJson.data, (progress: string) => {
                            response.write(formatData({ message: progress }), "utf-8", checkWrite);
                        });
                    }
                }
            }
            // process for method statement master
            response.write(formatData({ message: "Started process for adding statement reference details to repository." }), "utf-8", checkWrite);
            let methodStatementReferencesJson: any = await readJsonFile(join(extractPath, "method-statement-master", "method-statement-master.json"));
            if (methodStatementReferencesJson.code === 200) {
                await addMethodStatementReferences(workspace, methodStatementReferencesJson.data, (progress: string) => {
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
                await addMissingObjects(workspace, missingJson.data);
            }
            //process for entities
            response.write(formatData({ message: "Started process for getting  entities." }));
            let entityJson = await readJsonFile(join(extractPath, "entity-master", "entity-master.json"));
            if (entityJson.code === 200) {
                await addEntitiesAndAttributes(entityJson.data, workspace);
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
}).post("/upload-new-project-bundle/:wid/:pname", async function (request: Request | any, response: Response) {
    try {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
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
            let languageMaster: LanguageMaster = undefined;
            if (readWsJson.code === 200) {
                let wJson = readWsJson.data;
                languageMaster = await appService.languageMaster.getItem({ name: wJson.LanguageName });
            }
            if (languageMaster) {
                workspace.languageMaster = languageMaster;
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

            response.write(formatData({ message: "Project and Workspace details added successfully." }), "utf-8", checkWrite);
            await sleep(200);

            // get file-master data
            let readFmJson = await readJsonFile(join(extractPath, "file-master", "file-master.json"));
            if (readFmJson.code === 200) {
                response.write(formatData({ message: "Started adding file master details to repository." }), "utf-8", checkWrite);
                await addFileDetails(allFiles, languageMaster, readFmJson.data);
            }

            // get updated file-master data
            let readUpdatedFmJson = await readJsonFile(join(extractPath, "updated-file-master", "file-master.json"));
            if (readUpdatedFmJson.code === 200) {
                response.write(formatData({ message: "Started adding updated file master details to repository." }), "utf-8", checkWrite);
                await addFileDetails(allFiles, languageMaster, readUpdatedFmJson.data);
            }
            response.write(formatData({ extra: { totalFiles: allFiles.length }, message: `File details are added successfully to repository.` }), "utf-8", checkWrite);

            // process for network connectivity
            response.write(formatData({ message: "Started processing network connectivity." }), "utf-8", checkWrite);
            let netJson = await readJsonFile(join(extractPath, "member-references", "member-references.json"));
            if (netJson.code === 200) {
                // process for member details
                response.write(formatData({ message: "Started process for adding member references to repository." }), "utf-8", checkWrite);
                await addMemberReferenceWorkspace(workspace, netJson.data);
            }
            // process for member-references
            response.write(formatData({ message: "Started processing for member references." }), "utf-8", checkWrite);
            // let dotNetMemberJson = await readJsonFile(join(extractPath, "member-references", "member-references.json"));
            if (netJson.code === 200) {
                // special case for dot net repositories
                await addDotNetMemberReferencesWorkspace(workspace, netJson.data);
            }
            // process for action workflows and workflow connectivities
            // this is only for .NET and similar languages...
            response.write(formatData({ message: "Started process for adding action workflows to repository." }), "utf-8", checkWrite);

            let actionsJson = await readJsonFile(join(extractPath, "action-workflows", "action-workflows.json"));
            if (actionsJson.code === 200) {
                await processActionWorkflowsWorkspace(workspace, actionsJson.data);
            }

            // process for workflow connectivities
            response.write(formatData({ message: "Started process for adding workflow connectivities to repository." }), "utf-8", checkWrite);
            let workConnectJson = await readJsonFile(join(extractPath, "workflow-connectivities", "workflow-connectivities.json"));
            if (workConnectJson.code === 200) {
                await processActionsAndConnectivitiesWorkspace(workspace, actionsJson.data, workConnectJson.data);
            }

            // process for node details
            response.write(formatData({ message: "Started process for adding node details to the repository." }), "utf-8", checkWrite);
            let nodeDetailsJson = await readJsonFile(join(extractPath, "node-details", "node-details.json"));
            if (nodeDetailsJson.code === 200) {
                await addNodeDetailsWorkspace(workspace, nodeDetailsJson.data);
            }

            // process for link details
            response.write(formatData({ message: "Started process for adding link details to the repository." }), "utf-8", checkWrite);
            let linkDetailsJson = await readJsonFile(join(extractPath, "link-details", "link-details.json"));
            if (nodeDetailsJson.code === 200) {
                await addLinkDetailsWorkspace(workspace, linkDetailsJson.data);
            }

            // process for method details
            response.write(formatData({ message: "Started process for adding method details to repository." }), "utf-8", checkWrite);
            let methodDetailsJson: any = await readJsonFile(join(extractPath, "method-details", "method-details.json"));
            if (methodDetailsJson.code === 200) {
                await addMethodDetailsWorkspace(workspace, methodDetailsJson.data);
            }

            // process for method details
            // this is special case for dot net repositories
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

            // these are additional details for statement references
            // this is for dotnet and similar languages only
            response.write(formatData({ message: "Started process for additional statement references to repository." }), "utf-8", checkWrite);
            let expandedWorkflowFiles = fileExtensions.getAllFilesFromPath(join(extractPath, "", "expanded-workflows"), [], true);
            if (expandedWorkflowFiles.length > 0) {
                for (const ew of expandedWorkflowFiles) {
                    console.log("Expanded workflow file: ", ew);
                    let workflowJson = await readJsonFile(ew);
                    if (workflowJson.code === 200 && workflowJson.data.length > 0) {
                        await addStatementReferencesWorkspace(workspace, workflowJson.data, (progress: string) => {
                            response.write(formatData({ message: progress }), "utf-8", checkWrite);
                        });
                    }
                }
            }
            // process for file contents...
            response.write(formatData({ message: "Started processing file contents to repository." }), "utf-8", checkWrite);
            await processFileContentsWorkspace(workspace);

            // process for missing objects
            response.write(formatData({ message: "Started process for missing objects." }));
            let missingJson = await readJsonFile(join(extractPath, "missing-objects", "missing-objects.json"));
            if (missingJson.code === 200) {
                await addMissingObjectsWorkspace(workspace, missingJson.data);
            }
            //process for entities
            response.write(formatData({ message: "Started process for getting  entities." }));
            let entityJson = await readJsonFile(join(extractPath, "entity-master", "entity-master.json"));
            if (entityJson.code === 200) {
                await addEntitiesAndAttributesWorkspace(entityJson.data, workspace);
            }
            await processProjectInterConnectivity(workspace._id.toString());

            await processObjectInterConnectivity(workspace._id.toString());
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
}).post('/processObjectInterConnectivity', async (req, res) => {
    const wid = req.query.wid as string;

    if (!wid) {
        return res.status(400).json({ error: 'Missing workspace ID (wid)' });
    }

    try {
        // await processProjectInterConnectivity(wid);
        await processObjectInterConnectivity(wid);
        res.status(200).json({ message: 'Process completed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
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
}).get("/reprocess-method-details/:wid", async function (request: Request, response: Response) {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        if (!workspace) return response.status(404).end();
        let extractPath: string = <string>workspace.dirPath;
        let methodDetailsJson: any = await readJsonFile(join(extractPath, "method-details", "method-details.json"));
        if (methodDetailsJson.code === 200) {
            await addMethodDetails(workspace, methodDetailsJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(400).send(error).end();
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
        winstonLogger.info(`User ${request.user.fullName} has restarted processing of statement masters data.`, { code: 'reprocess-1002', name: 'reprocess-statement-references', extras: { id: request.user._id.toString() } });
        function checkWrite(err: any) {
            if (!err) return;
            winstonLogger.error(new Error("Error occurred during extraction"), { code: "EXTRACTION_ERROR", name: request.params.pname, extras: err });
            response.json({ message: "Error occurred during extraction", error: err }).end();
        }
        let collection = appService.mongooseConnection.collection("statementMaster");
        await collection.deleteMany({ wid: workspace._id });
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        let extractPath: string = <string>workspace.dirPath;
        let statementReferencesJson: any = await readJsonFile(join(extractPath, "statement-master", "statement-master.json"));
        if (statementReferencesJson.code === 200) {
            winstonLogger.info(`There are total: ${statementReferencesJson.data.length} records to process.`);
            await addStatementReferences(workspace, statementReferencesJson.data, (progress: string) => {
                response.write(formatData({ message: progress }), "utf-8", checkWrite);
            });
        }
        let expandedWorkflowFiles = fileExtensions.getAllFilesFromPath(join(extractPath, "project-files", "expanded-workflows"), [], true);
        if (expandedWorkflowFiles.length > 0) {
            for (const ew of expandedWorkflowFiles) {
                let workflowJson = await readJsonFile(ew);
                if (workflowJson.code === 200) {
                    await addStatementReferences(workspace, workflowJson.data, (progress: string) => {
                        response.write(formatData({ message: progress }), "utf-8", checkWrite);
                    });
                }
            }
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
            await addMissingObjects(workspace, missingJson.data);
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
            await addEntitiesAndAttributes(entityJson.data, workspace);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(500).send().end();
    }
}).get("/reprocess-node-details/:wid", async (request: Request, response: Response) => {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        let extractPath: string = <string>workspace.dirPath;
        let nodesJson: any = await readJsonFile(join(extractPath, "node-details", "node-details.json"));
        if (nodesJson.code === 200) {
            await addNodeDetails(workspace, nodesJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(500).send().end();
    }
}).get("/reprocess-link-details/:wid", async (request: Request, response: Response) => {
    try {
        let _id: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>request.params.wid);
        let workspace = await appService.workspaceMaster.aggregateOne([{ $match: { _id } }]);
        let extractPath: string = <string>workspace.dirPath;
        let linksJson: any = await readJsonFile(join(extractPath, "link-details", "link-details.json"));
        if (linksJson.code === 200) {
            await addLinkDetails(workspace, linksJson.data);
        }
        response.status(200).json().end();
    } catch (error) {
        response.status(500).send().end();
    }
});

const addNodeDetails = async function addNodeDetails(wm: WorkspaceMaster, nodeDetailsJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("nodeDetails");
        await collection.deleteMany({ wid: wm._id });
        let modifiedNodeDetails = convertStringToObjectId(nodeDetailsJson);
        for (const nodeDetail of modifiedNodeDetails) {
            await collection.insertOne(nodeDetail);
        }
    } catch (error) {
        console.log(error);
    }
};
const addLinkDetails = async function addLinkDetails(wm: WorkspaceMaster, linkDetailsJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("linkDetails");
        await collection.deleteMany({ wid: wm._id });
        let modifiedLinkDetails = convertStringToObjectId(linkDetailsJson);
        for (const linkDetail of modifiedLinkDetails) {
            await collection.insertOne(linkDetail);
        }
    } catch (error) {
        console.log(error);
    }
};
const addEntitiesAndAttributes = async function addEntitiesAndAttributes(entityJson: any[], wm: WorkspaceMaster) {
    try {
        let allowedFields = ["entityName", "attributes"];
        let allowedAttributeFields = ["attributeName", "dataType", "dataLength"];
        let modifiedEntityAttributes = convertStringToObjectId(entityJson);
        for (const element of modifiedEntityAttributes) {
            let entity: EntityMaster = { entityName: element.entityName, fid: element.fid, pid: element.pid, type: element.type, wid: wm._id } as EntityMaster;
            let em = await appService.entityMaster.addItem(entity);
            if (element.entityName === "None") {
                let variableDetails = { type: "Variable & Data Element", promptId: 1001, fid: element.fid, data: "None", formattedData: "None", genAIGenerated: false } as any;
                await appService.mongooseConnection.collection("businessSummaries").insertOne(variableDetails);
                continue;
            }
            let attributes = element.attributes || [];
            if (attributes.length === 0) continue;
            for (const attr of attributes) {
                let attribute: EntityAttributes = { pid: attr.pid, fid: attr.fid, eid: em._id, entityName: element.entityName, attributeName: attr.attributeName, dataLength: attr.dataLength, dataType: attr.dataType, storeEntitySet: attr.storeEntitySet } as EntityAttributes;
                await appService.entityAttributes.addItem(attribute);
            }
            let filteredObj = Object.keys(element).filter(key => allowedFields.includes(key)).reduce((acc: any, key) => {
                acc[key] = element[key];
                return acc;
            }, {});
            if (filteredObj.attributes && Array.isArray(filteredObj.attributes)) {
                filteredObj.attributes = filteredObj.attributes.map((attr: any) =>
                    Object.keys(attr).filter(key => allowedAttributeFields.includes(key)).reduce((acc: any, key) => {
                        acc[key] = attr[key];
                        return acc;
                    }, {}));
            }
            let variableDetails = { type: "Variable & Data Element", promptId: 1001, fid: Mongoose.Types.ObjectId.createFromHexString(element.fid), data: JSON.stringify(filteredObj), formattedData: JSON.stringify(filteredObj), genAIGenerated: false } as any;
            await appService.mongooseConnection.collection("businessSummaries").insertOne(variableDetails);
        }
    } catch (error) {
        throw error;
    }
};
const addStatementReferences = async function addStatementReferences(wm: WorkspaceMaster, statementMastersJson: any[], callback: Function): Promise<any> {
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

const addMethodStatementReferences = async function addMethodStatementReferences(wm: WorkspaceMaster, methodStatementMastersJson: any[], callback: Function): Promise<any> {
    try {
        let collection = appService.mongooseConnection.collection("methodStatementsMaster");
        let modifiedStatementMasters = convertStringToObjectId(methodStatementMastersJson);
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
        if (!(wm.languageMaster.name === "C#" || wm.languageMaster.name === "COBOL" || wm.languageMaster.name === "RPG")) return;
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
const addMissingObjects = async function addMissingObjects(wm: WorkspaceMaster, missingJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("missingObjects");
        await collection.deleteMany({ wid: wm._id });
        let modifiedMissingObjects = convertStringToObjectId(missingJson);
        for (const missingObj of modifiedMissingObjects) {
            await collection.insertOne(missingObj);
        }
    } catch (error) {
        console.log(error);
    }
};
const processFileContents = async function processFileContents(wm: WorkspaceMaster) {
    let projects = await appService.projectMaster.getDocuments({ wid: wm._id });
    let methodDetails = await appService.methodDetails.getDocuments({ wid: wm._id });
    for (const project of projects) {
        let collection = appService.fileContentMaster.getModel();
        await collection.deleteMany({ pid: project._id });
        let allFiles = await appService.fileMaster.aggregate([{ $match: { pid: project._id } }]);
        for (let file of allFiles) {
            // in case of COBOL language, we need to store sourceFilePath (original) contents as original 
            // and filePath contents are modified. We'll as this field only in case of COBOL
            let methodDetail = methodDetails.find((d) => d.fid.toString() === file._id.toString());
            let path = wm.languageMaster.name === "COBOL" || wm.languageMaster.name === "PLSQL" ? file.sourceFilePath : file.filePath;
            let content = fileExtensions.readTextFile(path);
            if (content === "") continue;
            // if COBOL then read filePath's contents and store this as modified
            let modified = wm.languageMaster.name === "COBOL" && file.fileTypeMaster.fileTypeName === "COBOL" ? fileExtensions.readTextFile(file.filePath) : "";
            if (wm.languageMaster.name === "PLSQL") {
                modified = fileExtensions.readTextFile(file.filePath);
            }
            let fcm = { methodId: methodDetail._id, fid: file._id, pid: file.pid, original: content, formatted: modified, wid: wm._id } as FileContentMaster;
            if (isEmpty(modified)) delete fcm.formatted;
            await appService.fileContentMaster.addItem(fcm);
        }
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
    if (["C#", "COBOL"].includes(wm.languageMaster.name)) return;

    try {
        let collection = appService.mongooseConnection.collection("memberReferences");
        // remove existing member references for the workspace
        let allFileTypes = await appService.fileTypeMaster.getDocuments({ _id: wm.languageMaster._id });
        await collection.deleteMany({ wid: wm._id });
        for (const member of memberRefJson) {
            let regEx = new RegExp(`^${member.FileTypeName}$`, 'i');
            let fileType = allFileTypes.find((d) => regEx.test(d.fileTypeName));  //  await appService.fileTypeMaster.getItem({ fileTypeName: { $regex: new RegExp(`^${member.FileTypeName}$`, 'i') } });
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
                callExternals: callExts,
                callers: member.callers,
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

const addMemberReferenceWorkspace = async (wm: WorkspaceMaster, memberRefJson: any[]) => {
    if (["C#", "COBOL"].includes(wm.languageMaster.name)) return;

    try {
        let collection = appService.mongooseConnection.collection("memberReferences");
        // remove existing member references for the workspace
        let allFileTypes = await appService.fileTypeMaster.getDocuments({ _id: wm.languageMaster._id });
        // await collection.deleteMany({ wid: wm._id });
        for (const member of memberRefJson) {
            let regEx = new RegExp(`^${member.FileTypeName}$`, 'i');
            let fileType = allFileTypes.find((d) => regEx.test(d.fileTypeName));  //  await appService.fileTypeMaster.getItem({ fileTypeName: { $regex: new RegExp(`^${member.FileTypeName}$`, 'i') } });
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
                callExternals: callExts,
                callers: member.callers,
            } as any;
            await appService.mongooseConnection.collection("memberReferences").insertOne(memberDetails);
        }
    } catch (ex) {
        console.log("Exception", ex);
    }
};

const addDotNetMemberReferencesWorkspace = async function addDotNetMemberReferencesWorkspace(wm: WorkspaceMaster, memberReferencesJson: any[]): Promise<any> {
    try {
        if (!(wm.languageMaster.name === "C#" || wm.languageMaster.name === "COBOL" || wm.languageMaster.name === "RPG" || wm.languageMaster.name === "Assembler")) return;
        let collection = appService.mongooseConnection.collection("memberReferences");
        // await collection.deleteMany({ wid: wm._id });
        let modifiedReferences = convertStringToObjectId(memberReferencesJson);
        for (const memberReference of modifiedReferences) {
            await collection.insertOne(memberReference);
        }
    } catch (error) {
        console.log(error);
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

const processActionWorkflowsWorkspace = async function processActionWorkflowsWorkspace(wm: WorkspaceMaster, actionsJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("actionWorkflows");
        let actionWorkflows = convertStringToObjectId(actionsJson);
        for (let aw of actionWorkflows) {
            await collection.insertOne(aw);
        }
    }
    catch (ex) {
        console.log("Exception", ex);
    }
};

const processActionsAndConnectivitiesWorkspace = async function processActionsAndConnectivitiesWorkspace(wm: WorkspaceMaster, actionsJson: any[], connectivityJson: any[]) {
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
    let updatedNodes = convertStringToObjectId(nodes);
    for (let node of updatedNodes) {
        await collection.insertOne(node);
    }
    for (let link of links) {
        await collection.insertOne(link);
    }
};


const addNodeDetailsWorkspace = async function addNodeDetailsWorkspace(wm: WorkspaceMaster, nodeDetailsJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("nodeDetails");
        let modifiedNodeDetails = convertStringToObjectId(nodeDetailsJson);
        for (const nodeDetail of modifiedNodeDetails) {
            await collection.insertOne(nodeDetail);
        }
    } catch (error) {
        console.log(error);
    }
};

const addLinkDetailsWorkspace = async function addLinkDetailsWorkspace(wm: WorkspaceMaster, linkDetailsJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("linkDetails");
        let modifiedLinkDetails = convertStringToObjectId(linkDetailsJson);
        for (const linkDetail of modifiedLinkDetails) {
            await collection.insertOne(linkDetail);
        }
    } catch (error) {
        console.log(error);
    }
};
const addMethodDetailsWorkspace = async function addMethodDetailsWorkspace(wm: WorkspaceMaster, methodDetailsJson: any[]): Promise<any> {
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
const addMissingObjectsWorkspace = async function addMissingObjectsWorkspace(wm: WorkspaceMaster, missingJson: any[]) {
    try {
        let collection = appService.mongooseConnection.collection("missingObjects");
        let modifiedMissingObjects = convertStringToObjectId(missingJson);
        for (const missingObj of modifiedMissingObjects) {
            await collection.insertOne(missingObj);
        }
    } catch (error) {
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

const addEntitiesAndAttributesWorkspace = async function addEntitiesAndAttributesWorkspace(entityJson: any[], wm: WorkspaceMaster) {
    try {
        let allowedFields = ["entityName", "attributes"];
        let allowedAttributeFields = ["attributeName", "dataType", "dataLength"];
        let modifiedEntityAttributes = convertStringToObjectId(entityJson);
        for (const element of modifiedEntityAttributes) {
            let entity: EntityMaster = { entityName: element.entityName, fid: element.fid, pid: element.pid, type: element.type, wid: wm._id } as EntityMaster;
            let em = await appService.entityMaster.addItem(entity);
            if (element.entityName === "None") {
                let variableDetails = { type: "Variable & Data Element", promptId: 1001, fid: element.fid, data: "None", formattedData: "None", genAIGenerated: false } as any;
                await appService.mongooseConnection.collection("businessSummaries").insertOne(variableDetails);
                continue;
            }
            let attributes = element.attributes || [];
            if (attributes.length === 0) continue;
            for (const attr of attributes) {
                let attribute: EntityAttributes = { pid: attr.pid, fid: attr.fid, eid: em._id, entityName: element.entityName, attributeName: attr.attributeName, dataLength: attr.dataLength, dataType: attr.dataType, storeEntitySet: attr.storeEntitySet } as EntityAttributes;
                await appService.entityAttributes.addItem(attribute);
            }
            let filteredObj = Object.keys(element).filter(key => allowedFields.includes(key)).reduce((acc: any, key) => {
                acc[key] = element[key];
                return acc;
            }, {});
            if (filteredObj.attributes && Array.isArray(filteredObj.attributes)) {
                filteredObj.attributes = filteredObj.attributes.map((attr: any) =>
                    Object.keys(attr).filter(key => allowedAttributeFields.includes(key)).reduce((acc: any, key) => {
                        acc[key] = attr[key];
                        return acc;
                    }, {}));
            }
            let variableDetails = { type: "Variable & Data Element", promptId: 1001, fid: Mongoose.Types.ObjectId.createFromHexString(element.fid), data: JSON.stringify(filteredObj), formattedData: JSON.stringify(filteredObj), genAIGenerated: false } as any;
            await appService.mongooseConnection.collection("businessSummaries").insertOne(variableDetails);
        }
    } catch (error) {
        throw error;
    }
};

const processFileContentsWorkspace = async function processFileContentsWorkspace(wm: WorkspaceMaster) {
    let projects = await appService.projectMaster.getDocuments({ wid: wm._id });
    let methodDetails = await appService.methodDetails.getDocuments({ wid: wm._id });
    for (const project of projects) {
        let collection = appService.fileContentMaster.getModel();
        let allFiles = await appService.fileMaster.aggregate([{ $match: { pid: project._id } }]);
        for (let file of allFiles) {
            // in case of COBOL language, we need to store sourceFilePath (original) contents as original 
            // and filePath contents are modified. We'll as this field only in case of COBOL
            let methodDetail = methodDetails.find((d) => d.fid.toString() === file._id.toString());
            let path = wm.languageMaster.name === "COBOL" || wm.languageMaster.name === "PLSQL" ? file.sourceFilePath : file.filePath;
            let content = fileExtensions.readTextFile(path);
            if (content === "") continue;
            // if COBOL then read filePath's contents and store this as modified
            let modified = wm.languageMaster.name === "COBOL" && file.fileTypeMaster.fileTypeName === "COBOL" ? fileExtensions.readTextFile(file.filePath) : "";
            if (wm.languageMaster.name === "PLSQL") {
                modified = fileExtensions.readTextFile(file.filePath);
            }
            let fcm = { methodId: methodDetail._id, fid: file._id, pid: file.pid, original: content, formatted: modified, wid: wm._id } as FileContentMaster;
            if (isEmpty(modified)) delete fcm.formatted;
            await appService.fileContentMaster.addItem(fcm);
        }
    }
};



const addWorkspaceIntoJson = async (extractPath: string, workspace: WorkspaceMaster) => {
    const files = [
        "action-workflows/action-workflows.json",
        "entity-master/entity-master.json",
        "file-master/file-master.json",
        "method-details/method-details.json",
        "missing-objects/missing-objects.json",
        "node-details/node-details.json",
        "project-master/project-master.json",
        "member-references/member-references.json",
        "field-and-properties/field-and-properties.json",
        "statement-master/statement-master.json",
        "workflow-connectivities/workflow-connectivities.json",
        "link-details/link-details.json",
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
                jsonData.data.forEach((d: Record<string, any>) => { d.wid = workspace._id; });
            }
            writeFileSync(filePath, JSON.stringify(jsonData.data, null, 2), "utf-8");
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }
};
const processProjectInterConnectivity = async (wid: string) => {
    try {
        let wd: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>wid);
        let wm: WorkspaceMaster = await appService.workspaceMaster.getItem({ _id: wd });
        // get collection object connectivity
        var collection = appService.mongooseConnection.collection("nodeDetails");
        // first we need to get all the projects which are in workspace
        var projects = await appService.projectMaster.getDocuments({ wid: wm._id });
        // then we need to get all the projects which are already in object connectivity
        var existingProjects = await appService.nodeDetails.getDocuments({ wid: wm._id, image: "system.png" });
        // then we need to filter out the projects which are already in object connectivity
        var filteredProjects = projects.filter((p) => !existingProjects.some((ep) => ep.pid.toString() === p._id.toString()));
        // then we need to add the projects which are not in object connectivity
        for (const pm of filteredProjects) {
            var projectNode = { name: pm.name, methodName: pm.name, methodId: pm._id, fileType: "Project", group: 3, level: 0, image: "system.png", pid: pm._id, wid: wm._id, type: 1, alternateName: "csproj" };
            await collection.insertOne(projectNode);
        }
    }
    catch (error) {
        winstonLogger.error(new Error("Error in adding projects nodes into object connectivity"), { code: "ADD_PROJECTS_NODES_ERROR", name: "", extras: error });
    }
};
const processObjectInterConnectivity = async (wid: string) => {
    try {
        let wd: Mongoose.Types.ObjectId = new Mongoose.Types.ObjectId(<string>wid);
        let wm: WorkspaceMaster = await appService.workspaceMaster.getItem({ _id: wd });
        var missingObjects = await appService.mongooseConnection.collection("missingObjects").aggregate([{ $match: { wid: wm._id } }]).toArray();
        let pipeLine: Array<PipelineStage> = [
            { $match: { wid: wm._id } },
            { $lookup: { from: "fileMaster", localField: "fid", foreignField: "_id", as: "fileMaster" } },
            { $unwind: { path: "$fileMaster", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "fileTypeMaster", localField: "fileMaster.fileTypeId", foreignField: "_id", as: "fileMaster.fileTypeMaster" } },
            { $unwind: { path: "$fileMaster.fileTypeMaster", preserveNullAndEmptyArrays: true } }
        ];
        let collection = appService.mongooseConnection.collection("linkDetails");
        const methodDetails = await appService.methodDetails.aggregate(pipeLine);
        var nodeDetails = await appService.nodeDetails.aggregate([{ $match: { wid: wm._id } }]);
        var linkDetails = await appService.linkDetails.aggregate([{ $match: { wid: wm._id } }]);
        const links: any[] = [];
        let projectLinks: any[] = [];
        for (const mo of missingObjects) {
            const fileTypes = mo.fileTypeName === "COBOL" ? ["COBOL", "ASM File"] : [mo.fileTypeName];
            var missingFile = Array.isArray(methodDetails) ? methodDetails.find(d => d.fileMaster.fileNameWithoutExt === mo.fileName && (Array.isArray(d.fileTypeMaster) ? d.fileMaster.fileTypeMaster.some((ft: any) => fileTypes.includes(ft.fileTypeName)) : fileTypes.includes(d.fileMaster.fileTypeMaster?.fileTypeName))) : undefined;
            if (!missingFile) continue;
            var sourceNode = nodeDetails.find((d) => d?.methodId?.toString() === mo?.methodId?.toString());
            var targetNode = nodeDetails.find((d) => d?.methodId?.toString() === missingFile?._id?.toString());
            if (!sourceNode || !targetNode) continue;
            var selectedMethodDetails = methodDetails.find((d) => d._id.toString() === sourceNode.methodId.toString() && d.methodName === sourceNode.methodName);
            if (selectedMethodDetails) {
                var callExternals = selectedMethodDetails.callExternals || [];
                let updated = false;
                if (callExternals.length > 0) {
                    for (const ce of callExternals) {
                        if (ce.methodName === mo.fileName) {
                            ce.methodId = targetNode.methodId;
                            ce.missing = false;
                            updated = true;
                            break;
                        }
                    }
                }
                if (updated) {
                    // Update the methodDetails document in the database
                    await appService.mongooseConnection.collection("methodDetails").updateOne({ _id: selectedMethodDetails._id }, { $set: { callExternals: callExternals, missing: false } });
                }
            }
            var sPid = sourceNode.pid?.toString();
            var tPid = targetNode.pid?.toString();
            if (!isEqual(sPid, tPid)) {
                var projectLink = { wid: mo.wid, pid: mo.pid, weight: 3, sourceId: sourceNode.pid, targetId: targetNode.pid, linkText: '', type: 4 };
                var exist = projectLinks.find((d) => d.sourceId.toString() === projectLink.sourceId.toString() && d.targetId.toString() === projectLink.targetId.toString() && d.type === 4);
                if (!exist)  projectLinks.push(projectLink);
            }
            var link = {
                wid: wm._id,
                pid: mo.pid,
                weight: 3,
                sourceId: sourceNode.methodId,
                targetId: targetNode.methodId,
                linkText: mo.fileName,
                type: 2
            };
            var existLink = links.find((d) => d.sourceId.toString() === link.sourceId.toString() && d.targetId.toString() === link.targetId.toString() && d.type === 2 && d.linkText === link.linkText);
            if(!existLink) links.push(link);
            await appService.mongooseConnection.collection("missingObjects").updateOne({ _id: mo._id }, { $set: { isMissing: false } });
        }

        // add project links to object connectivity
        for (let link of projectLinks) {
            var existLink = linkDetails.find((d) => d.sourceId.toString() === link.sourceId.toString() && d.targetId.toString() === link.targetId.toString() && d.type === 4);
            if (existLink) continue;
            await collection.insertOne(link);
        }
        // add links to object connectivity
        for (let link of links) {
            var existLink = linkDetails.find((d) => d.sourceId.toString() === link.sourceId.toString() && d.targetId.toString() === link.targetId.toString() && d.type === 2);
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
};

module.exports = pmRouter;