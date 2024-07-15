import { appService } from "../../services/app-service";
import Mongoose from "mongoose";
import { CobolMainProcessUtils } from "..";
import { ProjectMaster } from "../../models";
import { WinstonLogger, LogData } from "yogeshs-utilities";

const logger: WinstonLogger = new WinstonLogger(__filename);

const cobolProcessUtils: CobolMainProcessUtils = new CobolMainProcessUtils();
export class CobolProcessToExecute {
    public pid: string | Mongoose.Types.ObjectId;
    constructor(_id: string | Mongoose.Types.ObjectId) {
        this.pid = _id;
    }
    public get = function (name: string): Function {
        return this[name];
    }
    public static getProject = async function (_id: string | Mongoose.Types.ObjectId): Promise<ProjectMaster> {
        return await appService.projectMaster.findById(_id);
    }
    static changeExtensions = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started change extensions process for project: ${_id}`, { name: 'changeExtensions', code: 'change-extensions' } as LogData]);
        await cobolProcessUtils.changeExtensions(_id);
    };
    static processFileMasterData = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processFileMasterData for project: ${_id}`, { name: 'processFileMasterData', code: 'process-file-master-data' } as LogData]);
        await cobolProcessUtils.processFileMasterData(_id);
    }
    static processJCLFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processJCLFiles for project: ${_id}`, { name: 'processJCLFiles', code: 'process-jcl-files' } as LogData]);
        await cobolProcessUtils.processJCLFiles(_id);
    }
    static processCopyBookFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processCopyBookFiles for project: ${_id}`, { name: 'processCopyBookFiles', code: 'process-copybook-files' } as LogData]);
        await cobolProcessUtils.processCopyBookFiles(_id);
    }
    static processProcFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processProcFiles for project: ${_id}`, { name: 'processProcFiles', code: 'process-proc-files' } as LogData]);
        await cobolProcessUtils.processProcFiles(_id);
    }
    static processBMSFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processBMSFiles for project: ${_id}`, { name: 'processBMSFiles', code: 'process-bms-files' } as LogData]);
        await cobolProcessUtils.processBMSFiles(_id);
    }
    static processInputLibFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processInputLibFiles for project: ${_id}`, { name: 'processInputLibFiles', code: 'process-input-lib-files' } as LogData]);
        await cobolProcessUtils.processInputLibFiles(_id);
    }
    static processSqlFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processSqlFiles for project: ${_id}`, { name: 'processSqlFiles', code: 'process-sql-files' } as LogData]);
        await cobolProcessUtils.processSqlFiles(_id);
    }
    static processCobolFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        logger.debug.apply(this, [`Started processCobolFiles for project: ${_id}`, { name: 'processCobolFiles', code: 'process-cobol-files' } as LogData]);
        await cobolProcessUtils.processCobolFiles(_id);
    }
}