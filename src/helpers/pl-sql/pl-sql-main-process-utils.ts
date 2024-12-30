import { appService } from "../../services/app-service";
import { FileContentMaster, FileMaster, ProjectMaster, StatementMaster } from "../../models";
import { FileExtensions, ConsoleLogger, CobolHelpers } from "nextgen-utilities";
import Mongoose from "mongoose";
import ProgressBar from "progress";
import { basename } from "path";
import { isEmpty } from "lodash";

const logger: ConsoleLogger = new ConsoleLogger(__filename);
const fileExtensions: FileExtensions = new FileExtensions();

export default class PlSqlMainProcessUtils {
    public getProject = async function (_id: string | Mongoose.Types.ObjectId): Promise<ProjectMaster> {
        return await appService.projectMaster.findById(_id);
    }
    processFileMasterData = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const project = await this.getProject(_id);
            const extensions = await appService.fileTypeMaster.getDocuments({ lid: project.lid });
            const files: string[] = fileExtensions.getAllFilesFromPath(project.extractedPath, [], true);
            const bar: ProgressBar = logger.showProgress(files.length);
            logger.success(`Adding file master data to database.`, { totalFiles: files.length, project: project.name });
            let counter: number = 0;
            for (const file of files) {
                bar.tick({ done: ++counter, length: files.length });
                let lineCount = fileExtensions.getLinesCount(file);
                let extension = fileExtensions.getExtensionOnly(file);
                let fileTypeMaster = extensions.find((d) => d.fileTypeExtension === extension.toLowerCase());
                if (!fileTypeMaster) continue;
                let fileMaster: FileMaster = {
                    fileName: basename(file),
                    linesCount: lineCount + 1,
                    pid: project._id,
                    filePath: file,
                    fileStatics: { lineCount, parsed: false, processedLineCount: lineCount, exceptions: [] },
                    fileTypeId: fileTypeMaster._id,
                    fileNameWithoutExt: fileExtensions.getNameWithoutExtension(file)
                } as FileMaster;
                await appService.fileMaster.addItem(fileMaster);
            }
            bar.terminate();
            resolve({ status: "OK" })
        } catch (error) {
            reject({ status: "error", code: 'cobol-10012', error: error?.message, where: 'Process file master data function of cobol main process utils' });
        }
    });
    dumpFileContents = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        const project = await this.getProject(_id);
        let allFiles = await appService.fileMaster.getDocuments({ pid: project._id, processed: false });
        let bar: ProgressBar = logger.showProgress(allFiles.length);
        let index = 0;
        const commentRegex = /--.*$|\/\*[\s\S]*?\*\//gm;
        for (let file of allFiles) {
            bar.tick({ done: ++index, length: allFiles.length });
            let fileContent = fileExtensions.readTextFile(file.filePath);
            const formatted = fileContent.replace(commentRegex, '');
            let fcm: FileContentMaster = { fid: file._id, original: fileContent, formatted } as FileContentMaster;
            await appService.fileContentMaster.addItem(fcm);
        }
    });
    processPlSqlFiles = (_id: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        const project = await this.getProject(_id);
        const files = await appService.fileMaster.getDocuments({ pid: project._id, processed: false });
        const bar: ProgressBar = logger.showProgress(files.length);
        let index = 0;
        for (let fileMaster of files) {
            bar.tick({ done: ++index, length: files.length });
            let fcm = await appService.fileContentMaster.getItem({ fid: fileMaster._id });
            const lines = fcm.formatted.split("\n").filter((line) => !isEmpty(line.trim()));
            let lineDetails = CobolHelpers.prepareCobolLineDetails(lines);
            lineDetails.forEach((ld: any) => { if (ld.indicators.length <= 0) delete ld.indicators; });
            for (const lineDetail of lineDetails) {
                let statementMaster: StatementMaster;
                let sm: StatementMaster = Object.assign(lineDetail, statementMaster);
                sm.fid = fileMaster._id; sm.pid = fileMaster.pid;
                await appService.statementMaster.addItem(sm);
            }
            await appService.fileMaster.updateDocument({ _id: fileMaster._id }, { $set: { processed: true } });
            await this.sleep(500);
        }
        bar.terminate();
        resolve({ status: "OK" });
    });
    sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}