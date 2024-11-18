import { appService } from "../../services/app-service";
import { DataDependency, FileMaster, MissingObjects, ProjectMaster, StatementMaster } from "../../models";
import { FileExtensions, CobolHelpers, StatementProcessor, ConsoleLogger } from "nextgen-utilities";
import Mongoose from "mongoose";
import ProgressBar from "progress";
import { basename } from "path";
import { readFileSync } from "fs";
import CobolProcessHelpers from "./main-process-helpers";
import CobolConstants from "../../constants";
import { forIn, isEmpty } from "lodash";

const logger: ConsoleLogger = new ConsoleLogger(__filename);
const fileExtensions: FileExtensions = new FileExtensions();
export default class CobolMainProcessUtils extends CobolProcessHelpers {
    constructor() { super(); }
    public getProject = async function (_id: string | Mongoose.Types.ObjectId): Promise<ProjectMaster> {
        return await appService.projectMaster.findById(_id);
    }
    changeExtensions = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            let startTimeStamp = new Date();
            const project = await this.getProject(_id);
            let stage = await appService.processingStages.getItem({ pid: _id, stepName: "change file extensions" });
            if (stage.completedOn) return resolve({ status: "OK", message: "This stage is already processed!" });
            logger.info(`Executing change extensions process for project: ${project.name}`, { directory: project.extractedPath });
            const fileTypes = await appService.fileTypeMaster.getDocuments({ lid: project.lid });
            fileTypes.forEach((fileType) => {
                fileExtensions.changeExtensions(project.extractedPath, fileType.fileTypeExtension, fileType.folderNames);
            });
            // update change extensions stage against this project
            await appService.processingStages.updateDocument({ _id: stage._id }, { $set: { startedOn: startTimeStamp, completedOn: new Date() } });
            logger.info(`Completed change extensions process for project: ${project.name}`);
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10011', error: error?.message, where: 'Change extensions function of cobol main process utils' });
        }
    });
    processFileMasterData = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            let startTimeStamp = new Date();
            const project = await this.getProject(_id);
            let stage = await appService.processingStages.getItem({ pid: _id, stepName: "extract file details" });
            if (stage.completedOn) return resolve({ status: "OK", message: "This stage is already processed!" });
            const extensions = await appService.fileTypeMaster.getDocuments({ lid: project.lid });
            const files: string[] = fileExtensions.getAllFilesFromPath(project.extractedPath, [], true);
            const bar: ProgressBar = logger.showProgress(files.length);
            logger.success(`Adding file master data to database.`, { totalFiles: files.length, project: project.name });
            let counter: number = 0;
            for (const file of files) {
                bar.tick({ done: ++counter, length: files.length });
                let extension = fileExtensions.getExtensionOnly(file);
                let fileTypeMaster = extensions.find((d) => d.fileTypeExtension === extension.toLowerCase());
                if (!fileTypeMaster) continue;
                let fileMaster: FileMaster = {
                    fileName: basename(file),
                    pid: project._id,
                    filePath: file,
                    fileStatics: { lineCount: 100, parsed: false, processedLineCount: 60, exceptions: [] },
                    fileTypeId: fileTypeMaster._id,
                    fileNameWithoutExt: fileExtensions.getNameWithoutExtension(file)
                } as FileMaster;
                await appService.fileMaster.addItem(fileMaster);
            }
            bar.terminate();
            // update change extensions stage against this project
            await appService.processingStages.updateDocument({ _id: stage._id }, { $set: { startedOn: startTimeStamp, completedOn: new Date() } });
            resolve({ status: "OK" })
        } catch (error) {
            reject({ status: "error", code: 'cobol-10012', error: error?.message, where: 'Process file master data function of cobol main process utils' });
        }
    });
    processJCLFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            let startTimeStamp = new Date();
            const project = await this.getProject(_id);
            let stage = await appService.processingStages.getItem({ pid: _id, stepName: "process JCL files" });
            if (stage.completedOn) return resolve({ status: "OK", message: "This stage is already processed!" });
            // get all files for project            
            let allFiles = await appService.fileMaster.getDocuments({ pid: project._id, processed: false });
            let jclFiles = allFiles.filter((d) => d.fileTypeId.toString() === "67036016f53c182f751ed03c")
            let bcReferences = await appService.baseCommandReference.getAllDocuments();
            let index = 0;
            logger.log("Current status");
            logger.warning(`There are total: ${jclFiles.length} JCL files to process.`);
            let bar = logger.showProgress(jclFiles.length);
            for (const fileMaster of jclFiles.filter((d) => !d.processed)) {
                bar.tick({ done: ++index, length: jclFiles.length });
                let allLines = readFileSync(fileMaster.filePath).toString().split(/\n/i);
                let lineDetails = CobolHelpers.prepareCobolLineDetails(allLines); // utilities check -- done!
                lineDetails = CobolHelpers.prepareJclSameLength(lineDetails); // utilities check -- done!
                lineDetails = CobolHelpers.removeStartCharacter(lineDetails, "/"); // utilities check -- done!
                lineDetails = CobolHelpers.removeAllCommentedLines(lineDetails, ["*"]); // utilities check -- done!                
                lineDetails = CobolHelpers.combineAllBrokenLines(lineDetails, ",", true); // utilities check -- done!
                lineDetails = CobolHelpers.removeSpacesBetweenWords(lineDetails); // utilities check -- done!
                lineDetails = this.assignBaseCommandIndicators(lineDetails as any, bcReferences);
                let stepsData = CobolHelpers.getStepsData(lineDetails); // utilities check -- done!
                await this.processStepsData(stepsData, { allFiles, fileMaster }); // utilities check -- done!
                lineDetails = this.doPseudoCodeConversion(lineDetails as any); // utilities check -- done!
                // following is not needed for now...
                // let dsnDataSets = CobolHelpers.getDsnDataSets(lineDetails, { fid: fileMaster._id, pid: fileMaster.pid });
                // TODO: need to check following function if it's working properly or not
                let fileInfo = fileExtensions.getFileInfo(fileMaster.filePath);
                // logger.info("File info", fileInfo);
                let startSm = this.prepareStatementMasterStart([3], fileMaster, {
                    originalLine: fileInfo.name,
                    classNameDeclared: fileInfo.name,
                    modifiedLine: fileInfo.name
                });
                await appService.statementMaster.addItem(startSm);
                let methodStartSm = this.prepareStatementMasterStart([5], fileMaster, {
                    originalLine: fileInfo.name,
                    methodName: fileInfo.name,
                    modifiedLine: fileInfo.name
                });
                await appService.statementMaster.addItem(methodStartSm);
                lineDetails.forEach((ld: any) => { if (ld.indicators.length <= 0) delete ld.indicators; });
                for (const lineDetail of lineDetails) {
                    let statementMaster: StatementMaster;
                    let sm: StatementMaster = Object.assign(lineDetail, statementMaster);
                    sm.fid = fileMaster._id; sm.pid = fileMaster.pid;
                    await appService.statementMaster.addItem(sm);
                }

                await appService.fileMaster.updateDocument({ _id: fileMaster._id }, { $set: { linesCount: allLines.length, fileStatics: { lineCount: allLines.length, processedLineCount: lineDetails.length, parsed: true }, processed: true } });
                await this.sleep(500);
            }
            bar.terminate();
            // update change extensions stage against this project
            await appService.processingStages.updateDocument({ _id: stage._id }, { $set: { startedOn: startTimeStamp, completedOn: new Date() } });
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10013', error: error?.message, where: 'Process JCL files function of cobol main process utils' });
        }
    });
    processCopyBookFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            let startTimeStamp = new Date();
            const project = await this.getProject(_id);
            let stage = await appService.processingStages.getItem({ pid: _id, stepName: "process CopyBook files" });
            if (stage.completedOn) return resolve({ status: "OK", message: "This stage is already processed!" });
            let allFiles = await appService.fileMaster.getDocuments({ pid: project._id, fileTypeId: new Mongoose.Types.ObjectId("67036016f53c182f751ed036") });
            let indicators = await appService.baseCommandReference.getAllDocuments();
            let index = 0;
            logger.log("Current status");
            logger.warning(`There are total: ${allFiles.length} CopyBook files to process.`);
            let bar = logger.showProgress(allFiles.length);
            for (const fileMaster of allFiles) {
                bar.tick({ done: ++index, length: allFiles.length });
                let allLines = readFileSync(fileMaster.filePath).toString().split(/\n/i);
                let lineDetails = CobolHelpers.prepareCobolLineDetails(allLines);
                lineDetails = CobolHelpers.prepareJclSameLength(lineDetails);
                lineDetails = CobolHelpers.removeStartCharacter(lineDetails, "/");
                lineDetails = CobolHelpers.removeAllCommentedLines(lineDetails, ["*"]);
                lineDetails = CobolHelpers.removeSpacesBetweenWords(lineDetails);
                lineDetails = CobolHelpers.combineAllBrokenLines(lineDetails, ",", true);
                lineDetails = this.assignBaseCommandIndicators(lineDetails as any, indicators);
                await appService.fileMaster.updateDocument({ _id: fileMaster._id }, { $set: { linesCount: allLines.length, fileStatics: { lineCount: allLines.length, processedLineCount: lineDetails.length, parsed: true }, processed: true } });
            }
            bar.terminate();
            // update change extensions stage against this project
            await appService.processingStages.updateDocument({ _id: stage._id }, { $set: { startedOn: startTimeStamp, completedOn: new Date() } });
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10014', error: error?.message, where: 'Process CopyBook files function of cobol main process utils' });
        }
    });
    processProcFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            let startTimeStamp = new Date();
            const project = await this.getProject(_id);
            let stage = await appService.processingStages.getItem({ pid: _id, stepName: "process PROC files" });
            let allFiles = await appService.fileMaster.getDocuments({ pid: project._id });
            let procFiles = await appService.fileMaster.getDocuments({ pid: project._id, fileTypeId: new Mongoose.Types.ObjectId("67036016f53c182f751ed035") });
            let bcReferences = await appService.baseCommandReference.getAllDocuments();
            let index = 0;
            logger.log("Current status");
            logger.warning(`There are total: ${allFiles.length} PROC files to process.`);
            let bar = logger.showProgress(allFiles.length);
            for (const fileMaster of procFiles) {
                bar.tick({ done: ++index, length: procFiles.length });
                let allLines = readFileSync(fileMaster.filePath).toString().split(/\n/i);
                let lineDetails = CobolHelpers.prepareCobolLineDetails(allLines); // utilities check -- done!
                lineDetails = CobolHelpers.prepareJclSameLength(lineDetails); // utilities check -- done!
                lineDetails = CobolHelpers.removeStartCharacter(lineDetails, "/"); // utilities check -- done!
                lineDetails = CobolHelpers.removeAllCommentedLines(lineDetails, ["*"]); // utilities check -- done!                
                lineDetails = CobolHelpers.combineAllBrokenLines(lineDetails, ",", true); // utilities check -- done!
                lineDetails = CobolHelpers.removeSpacesBetweenWords(lineDetails); // utilities check -- done!
                lineDetails = this.assignBaseCommandIndicators(lineDetails as any, bcReferences);
                let stepsData = CobolHelpers.getStepsData(lineDetails); // utilities check -- done!
                await this.processStepsData(stepsData, { allFiles, fileMaster }); // utilities check -- done!
                lineDetails = this.doPseudoCodeConversion(lineDetails as any); // utilities check -- done!
                // following is not needed for now...
                // let dsnDataSets = CobolHelpers.getDsnDataSets(lineDetails, { fid: fileMaster._id, pid: fileMaster.pid });
                // TODO: need to check following function if it's working properly or not
                let fileInfo = fileExtensions.getFileInfo(fileMaster.filePath);
                // logger.info("File info", fileInfo);
                let startSm = this.prepareStatementMasterStart([3], fileMaster, {
                    originalLine: fileInfo.name,
                    classNameDeclared: fileInfo.name,
                    modifiedLine: fileInfo.name
                });
                await appService.statementMaster.addItem(startSm);
                let methodStartSm = this.prepareStatementMasterStart([5], fileMaster, {
                    originalLine: fileInfo.name,
                    methodName: fileInfo.name,
                    modifiedLine: fileInfo.name
                });
                await appService.statementMaster.addItem(methodStartSm);
                lineDetails.forEach((ld: any) => { if (ld.indicators.length <= 0) delete ld.indicators; });
                for (const lineDetail of lineDetails) {
                    let statementMaster: StatementMaster;
                    let sm: StatementMaster = Object.assign(lineDetail, statementMaster);
                    sm.fid = fileMaster._id; sm.pid = fileMaster.pid;
                    await appService.statementMaster.addItem(sm);
                }
                // update fileStatics for fileMaster and linesCount
                await appService.fileMaster.updateDocument({ _id: fileMaster._id }, { $set: { linesCount: allLines.length, fileStatics: { lineCount: allLines.length, processedLineCount: lineDetails.length, parsed: true }, processed: true } });
                await this.sleep(500);
            }
            bar.terminate();
            // update change extensions stage against this project
            await appService.processingStages.updateDocument({ _id: stage._id }, { $set: { startedOn: startTimeStamp, completedOn: new Date() } });
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10014', error: error?.message, where: 'Process CopyBook files function of cobol main process utils' });
        }
    });
    processBMSFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            let startTimeStamp = new Date();
            const project = await this.getProject(_id);
            let stage = await appService.processingStages.getItem({ pid: _id, stepName: "process BMS files" });
            // get all files for project            
            let allFiles = await appService.fileMaster.getDocuments({ pid: project._id });
            let allBmsFiles = await appService.fileMaster.getDocuments({ pid: project._id, fileTypeId: new Mongoose.Types.ObjectId("67036016f53c182f751ed037") });
            let index = 0;
            logger.log("Current status");
            logger.warning(`There are total: ${allFiles.length} BMS files to process.`);
            let bar = logger.showProgress(allFiles.length);
            for (const fileMaster of allBmsFiles) {
                bar.tick({ done: ++index, length: allBmsFiles.length });
                let allLines = readFileSync(fileMaster.filePath).toString().split(/\n/i);
                let lineDetails = CobolHelpers.prepareCobolLineDetails(allLines); // utilities check -- done!
                lineDetails = CobolHelpers.prepareJclSameLength(lineDetails); // utilities check -- done!
                lineDetails = CobolHelpers.removeStartCharacter(lineDetails, "/"); // utilities check -- done!
                lineDetails = CobolHelpers.removeAllCommentedLines(lineDetails, ["*"]); // utilities check -- done!                
                lineDetails = CobolHelpers.combineAllBrokenLines(lineDetails, ",", true); // utilities check -- done!
                lineDetails = CobolHelpers.removeSpacesBetweenWords(lineDetails); // utilities check -- done!
                lineDetails = CobolHelpers.concatBmsInitialValues(lineDetails);
                // TODO: check following function processBmsMapControls is working properly or not
                // also need to assign fid, pid for root and mapControls array objects
                let bmsMaps = CobolHelpers.processBmsMapControls(lineDetails);
                console.log(bmsMaps);
                let fileInfo = fileExtensions.getFileInfo(fileMaster.filePath);
                // logger.info("File info", fileInfo);
                let startSm = this.prepareStatementMasterStart([3], fileMaster, {
                    originalLine: fileInfo.name,
                    classNameDeclared: fileInfo.name,
                    modifiedLine: fileInfo.name
                });
                await appService.statementMaster.addItem(startSm);
                let methodStartSm = this.prepareStatementMasterStart([5], fileMaster, {
                    originalLine: fileInfo.name,
                    methodName: fileInfo.name,
                    modifiedLine: fileInfo.name
                });
                await appService.statementMaster.addItem(methodStartSm);
                lineDetails.forEach((ld: any) => { if (ld.indicators.length <= 0) delete ld.indicators; });
                for (const lineDetail of lineDetails) {
                    let statementMaster: StatementMaster;
                    let sm: StatementMaster = Object.assign(lineDetail, statementMaster);
                    sm.fid = fileMaster._id; sm.pid = fileMaster.pid;
                    await appService.statementMaster.addItem(sm);
                }
                // update fileStatics for fileMaster and linesCount
                await appService.fileMaster.updateDocument({ _id: fileMaster._id }, { $set: { linesCount: allLines.length, fileStatics: { lineCount: allLines.length, processedLineCount: lineDetails.length, parsed: true }, processed: true } });
                await this.sleep(500);
            }
            bar.terminate();
            // update change extensions stage against this project
            await appService.processingStages.updateDocument({ _id: stage._id }, { $set: { startedOn: startTimeStamp, completedOn: new Date() } });
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10014', error: error?.message, where: 'Process CopyBook files function of cobol main process utils' });
        }
    });
    processInputLibFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const project = await this.getProject(_id);
            let allFiles = await appService.fileMaster.getDocuments({ pid: project._id, fileTypeId: new Mongoose.Types.ObjectId("67036016f53c182f751ed03a") });
            let indicators = await appService.baseCommandReference.getAllDocuments();
            let index = 0;
            logger.log("Current status");
            logger.warning(`There are total: ${allFiles.length} InputLib files to process.`);
            let bar = logger.showProgress(allFiles.length);
            for (const fileMaster of allFiles) {
                bar.tick({ done: ++index, length: allFiles.length });
                let allLines = readFileSync(fileMaster.filePath).toString().split(/\n/i);
                let lineDetails = CobolHelpers.prepareCobolLineDetails(allLines);
                lineDetails = CobolHelpers.prepareJclSameLength(lineDetails);
                lineDetails = CobolHelpers.removeStartCharacter(lineDetails, "/");
                lineDetails = CobolHelpers.removeAllCommentedLines(lineDetails, ["*"]);
                lineDetails = CobolHelpers.removeSpacesBetweenWords(lineDetails);
                lineDetails = CobolHelpers.combineAllBrokenLines(lineDetails, ",", true);
                lineDetails = this.assignBaseCommandIndicators(lineDetails as any, indicators);
            }
            bar.terminate();
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10014', error: error?.message, where: 'Process CopyBook files function of cobol main process utils' });
        }
    });
    processSqlFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const project = await this.getProject(_id);
            let allFiles = await appService.fileMaster.getDocuments({ pid: project._id, fileTypeId: new Mongoose.Types.ObjectId("67036016f53c182f751ed038") });
            let indicators = await appService.baseCommandReference.getAllDocuments();
            let index = 0;
            logger.log("Current status");
            logger.warning(`There are total: ${allFiles.length} JCL files to process.`);
            let bar = logger.showProgress(allFiles.length);

            bar.terminate();
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10014', error: error?.message, where: 'Process CopyBook files function of cobol main process utils' });
        }
    });
    processCobolFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const project = await this.getProject(_id);
            let allFiles = await appService.fileMaster.getDocuments({ pid: project._id });
            let cobolFiles = allFiles.filter((d) => !d.processed && d.fileTypeId.toString() === "67036016f53c182f751ed03b");
            let bcReferences = await appService.baseCommandReference.getAllDocuments();
            let index = 0;
            logger.warning(`There are total: ${cobolFiles.length} COBOL files to process.`);
            let bar = logger.showProgress(cobolFiles.length);
            for (const fileMaster of cobolFiles) {
                bar.tick({ done: ++index, length: cobolFiles.length });
                let allLines = readFileSync(fileMaster.filePath).toString().split(/\n/i);
                let lineDetails = CobolHelpers.prepareCobolLineDetails(allLines);
                lineDetails = CobolHelpers.prepareSameLength(lineDetails);
                lineDetails = CobolHelpers.removeCharacter(lineDetails, 6, 66);

                // let businessName = this.extractBusinessName(lineDetails as any);
                // logger.info("businessName:- ", { businessName });

                lineDetails = CobolHelpers.removeAllCommentedLines(lineDetails, ["*", "/"]);
                lineDetails = this.removeAll(lineDetails as any, "SKIP", "EJECT", "SKIP1", "SKIP2", "SKIP3", "SKIP4");
                lineDetails = CobolHelpers.splitLinesAfterDotForCobol(lineDetails);
                // var copyCallStatements = CobolHelpers.getCopyStatementsFromWorkingStorageSection(lineDetails as any); // need to verify -- done!
                // let copyStatements = this.removeDot(copyCallStatements as any); // need to verify -- done!
                // TODO: uncomment following line
                // await this.processCopyStatements(fileMaster, copyStatements as any, allFiles); // need to verify -- done!
                lineDetails = CobolHelpers.splitCopyAndReplacingStatement(lineDetails); // need to verify -- done!
                let missingObjects: Array<MissingObjects> = [];
                lineDetails = await this.addIncludeFileLines(lineDetails as any, fileMaster, allFiles, missingObjects); // need to verify -- done!
                // TODO: add code for adding missingObjects to database.
                let cobolSections = CobolConstants.cobolSections.map((d) => d.sectionName); // need to verify
                // let fileSection = this.getAnyGenericSection(lineDetails as any, cobolSections); // need to verify
                // TODO: add code for adding / processing file section
                
                // let fileControlSection = this.getAnyGenericSection(lineDetails as any, cobolSections, "FILE-CONTROL."); // need to verify
                // let controlStatements = this.combineAllLinesOfWorkingStorageSection(fileControlSection.map((d) => d.modifiedLine)); // need to verify -- done!
                // let dataSetStatements = this.getDataSetStatements(controlStatements); // need to verify

                // TODO: add code for processing and dataSetStatements to database
                let execSqlStatements = this.combineAllExecSqlStatements(lineDetails as any); // need to verify
                // let lstCursors = CobolHelpers.extractCursorsFromExecSql(execSqlStatements); // need to verify
                // TODO: do further processing for lstCursors.
                let sqlStatements = execSqlStatements.map((d) => d.modifiedLine); // need to verify
                await this.processExecSqlStatements(sqlStatements, fileMaster.projectMaster, fileMaster); // need to verify
                let programLines: string[] = lineDetails.map((d: any) => d.modifiedLine);
                let procedureDivisionLines = this.getAllDataBetweenProcedureDivision(programLines); // need to verify -- done!
                // there were two separate functions in C#, now following function will return all methodNames
                // but there is also a method available in utilities getMethodName from procedureDivisionLines
                let allMethods = this.getAllMethods(procedureDivisionLines) || []; // need to verify -- done!
                lineDetails = this.modifyAllMethodsNameLines(lineDetails as any, allMethods); // need to verify -- done!
                // ** Important **
                // Following lines were commented on 19 November 2024 by Yogesh Sonawane
                // TODO: Do not uncomment following 7 lines
                // let fileSectionLines = this.getStatementBetweenSection(lineDetails as any, cobolSections, "FILE SECTION."); // need to verify
                // let workingStorageSection = this.getWorkingStorageSection(lineDetails as any, cobolSections); // need to verify -- done!
                // let workingSection = this.combineAllLinesInSection(workingStorageSection); // need to verify -- done!
                // await this.insertWorkingStorageSection(workingSection, fileMaster); // need to verify -- done!
                // let linkSection = this.getLinkageSection(lineDetails as StatementMaster[], cobolSections);
                // let linkageSection = this.combineAllLinesInSection(linkSection);
                // await this.insertWorkingStorageSection(linkageSection, fileMaster);
                allMethods = CobolHelpers.removeDotFromMethodName(allMethods); // need to verify -- done!
                let methodLines = this.collectAllMethodsData(lineDetails as any, allMethods); // need to verify -- done!
                // TODO: need to get and store data into following variable
                let cobolKeyWords: [] = [];
                const rex = CobolConstants.cobolSections.find((d) => d.sectionName === "PROCEDURE DIVISION.").regEx;
                let cobolVariables = await appService.cobolVariables.getDocuments({ fid: fileMaster._id, pid: fileMaster.pid });
                forIn(methodLines, async (methodBlock, method) => {
                    var mainKey = method.trim();
                    if (isEmpty(mainKey)) return;
                    if (methodBlock.length <= 0) return;
                    // var finalBlock: StatementMaster[] = [];
                    /*
                    if (rex.test(mainKey)) {
                        allMethods.shift();
                        let afterPd = mainKey.replace(rex, "").trim();
                        if (isEmpty(afterPd)) return;
                        methodBlock[0].modifiedLine = afterPd;
                        mainKey = "MAINLINE";
                        allMethods.unshift(mainKey);
                    }
                    */
                    // if (methodBlock.length === 0) methodBlock.push({ lineIndex: 0, modifiedLine: "EXIT", originalLine: "EXIT", indicators: [], alternateName: '' } as StatementMaster);
                    // finalBlock.push({ modifiedLine: mainKey, originalLine: method.trim(), lineIndex: 0, alternateName: '', indicators: [] } as StatementMaster);
                    // ** Important **
                    // Following lines were commented on 19 November 2024 by Yogesh Sonawane
                    // TODO: Do not uncomment following commented lines, these are commented by purpose
                    // methodBlock = this.splitGoToStatement(methodBlock);
                    // methodBlock = this.replaceStatement(methodBlock, "GO TO ", "PERFORM ");
                    methodBlock = this.combineAllExecSqlStatements(methodBlock);
                    methodBlock = this.combineLineForMoveToStatement(methodBlock, cobolKeyWords);
                    // methodBlock = this.convertAllMoveStatement(methodBlock, cobolKeyWords);
                    methodBlock = this.addEndIfStatement(methodBlock);
                    // methodBlock = this.addNewLineForMultipleKeyword(methodBlock, cobolKeyWords);
                    // methodBlock = this.splitAllLinesAfterDot(methodBlock);
                    // methodBlock = this.conversionOfEvaluateStatement(methodBlock);
                    methodBlock = CobolHelpers.removeSpacesBetweenWords(methodBlock) as Array<StatementMaster>;
                    // methodBlock = this.conversionOfCrudActivities(methodBlock);
                    methodBlock = this.removeExecStatement(methodBlock);
                    // methodBlock = this.combineAllNonKeywordLines(methodBlock, cobolKeyWords);
                    // methodBlock = StatementProcessor.performVarying(methodBlock, allMethods, cobolVariables) as Array<StatementMaster>;
                    methodBlock = this.assignBaseCommandIndicators(methodBlock as any, bcReferences);
                    // TODO: verify conditions and end conditions count
                    // if it's not matching then make parsing status of file as not processed
                    // methodBlock.push({ lineIndex: methodBlock.length + 1, originalLine: "END", modifiedLine: "END", indicators: [], alternateName: '' } as StatementMaster);

                    for (const lineDetail of methodBlock) {
                        let line = lineDetail.originalLine.trim();
                        if (!line || CobolConstants.RegularExpressions.regexEndPerform.test(line)) continue;
                        if (CobolConstants.RegularExpressions.regExCall.test(line)) {
                            const cStatement = CobolHelpers.extractKeyword(line);
                            const isCallVariable = CobolHelpers.isInSingleQuotes(cStatement);
                            if (!isEmpty(isCallVariable)) {
                                const callMatch = line.match(CobolConstants.RegularExpressions.regExCall);
                                if (!callMatch) continue;
                                const pgmName = callMatch[1];
                                if (!pgmName) return null;
                                const objectName = pgmName.trim().replace(/^['"]|['"]$/g, '').trim();
                                const anyFile = allFiles.some((f) => f.fileNameWithoutExt === objectName.toUpperCase());
                                if (isEmpty(anyFile)) break;
                                const variable = cobolVariables.find((d) => d.variableName === objectName);
                                if (isEmpty(variable)) break;
                                const defaultValue = variable.defaultValue;
                                line = line.replace(pgmName, `${defaultValue} `);
                            }
                        }
                        let sm: StatementMaster = {
                            lineIndex: lineDetail.lineIndex, modifiedLine: line,
                            originalLine: lineDetail.originalLine, indicators: lineDetail.indicators,
                            alternateName: lineDetail.alternateName, businessName: lineDetail.businessName,
                            methodCalled: lineDetail.methodCalled, methodName: lineDetail.methodName,
                            classNameDeclared: lineDetail.classNameDeclared, classCalled: lineDetail.classCalled,
                            fid: lineDetail.fid || fileMaster._id, pid: lineDetail.pid || fileMaster.pid
                        } as StatementMaster;
                        await appService.statementMaster.addItem(sm);
                    }
                });
                await appService.fileMaster.updateDocument({ _id: fileMaster._id }, { $set: { linesCount: allLines.length, fileStatics: { lineCount: allLines.length, processedLineCount: lineDetails.length, parsed: true }, processed: true } });
                await this.sleep(500);
            }
            bar.terminate();
            resolve({ status: "OK" });
        } catch (error) {
            reject({ status: "error", code: 'cobol-10014', error: error?.message, where: 'Process COBOL files function of cobol main process utils' });
        }
    });
    processDataDependency = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const project = await this.getProject(_id);
            const entities = await appService.entityMaster.getDocuments({ pid: project._id });
            const existingData = await appService.dataDependency.getDocuments({ pid: project._id });
            for (const entity of entities) {
                const entityName = entity.entityName;
                const regex = new RegExp(`\\b${entityName}\\b`, "i");
                const statementReferenceMaster = await appService.statementMaster.getDocuments({ pid: project._id, modifiedLine: { $regex: entityName, $options: "i" } as any, indicators: { $in: [45] } as any });
                if (!statementReferenceMaster.length) continue;
                for (const statementReference of statementReferenceMaster) {
                    if (!regex.test(statementReference.originalLine)) continue;
                    const dataDependency = { pid: project._id, fid: statementReference.fid, entity: entityName, attributes: '' } as DataDependency;
                    const existing = existingData.some(x => x.fid === statementReference.fid && x.entity === entityName && x.pid === project._id);
                    if (existing) continue;
                    await appService.dataDependency.addItem(dataDependency);
                }
            }
            resolve({ statusCode: 200, data: "Done" });
        } catch (error) {
            reject({ statusCode: 500, data: error.message });
        }
    });
    sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}