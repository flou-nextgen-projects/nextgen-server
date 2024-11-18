import { appService } from "../../services/app-service";
import Mongoose from "mongoose";
import { CobolMainProcessUtils } from "..";
import { ProjectMaster } from "../../models";
import { WinstonLogger, LogData } from "nextgen-utilities";
export class CobolProcessToExecute {
    public pid: string | Mongoose.Types.ObjectId;
    public logger: WinstonLogger;
    public cobolProcessUtils: CobolMainProcessUtils;
    constructor(_id: string | Mongoose.Types.ObjectId) {
        this.pid = _id;
        this.logger = new WinstonLogger(__filename);
        this.cobolProcessUtils = new CobolMainProcessUtils();
    }
    public get = function (name: string): Function {
        return this[name];
    }
    public getProject = async function (_id: string | Mongoose.Types.ObjectId): Promise<ProjectMaster> {
        return await appService.projectMaster.findById(_id);
    }
    public changeExtensions = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started change extensions process for project: ${_id}`, { name: 'changeExtensions', code: 'change-extensions' } as LogData]);
        await this.cobolProcessUtils.changeExtensions(_id);
    };
    public processFileMasterData = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processFileMasterData for project: ${_id}`, { name: 'processFileMasterData', code: 'process-file-master-data' } as LogData]);
        await this.cobolProcessUtils.processFileMasterData(_id);
    }
    public processJCLFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processJCLFiles for project: ${_id}`, { name: 'processJCLFiles', code: 'process-jcl-files' } as LogData]);
        await this.cobolProcessUtils.processJCLFiles(_id);
    }
    public processCopyBookFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processCopyBookFiles for project: ${_id}`, { name: 'processCopyBookFiles', code: 'process-copybook-files' } as LogData]);
        await this.cobolProcessUtils.processCopyBookFiles(_id);
    }
    public processProcFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processProcFiles for project: ${_id}`, { name: 'processProcFiles', code: 'process-proc-files' } as LogData]);
        await this.cobolProcessUtils.processProcFiles(_id);
    }
    public processBMSFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processBMSFiles for project: ${_id}`, { name: 'processBMSFiles', code: 'process-bms-files' } as LogData]);
        await this.cobolProcessUtils.processBMSFiles(_id);
    }
    public processInputLibFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processInputLibFiles for project: ${_id}`, { name: 'processInputLibFiles', code: 'process-input-lib-files' } as LogData]);
        await this.cobolProcessUtils.processInputLibFiles(_id);
    }
    public processSqlFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processSqlFiles for project: ${_id}`, { name: 'processSqlFiles', code: 'process-sql-files' } as LogData]);
        await this.cobolProcessUtils.processSqlFiles(_id);
    }
    public processCobolFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processCobolFiles for project: ${_id}`, { name: 'processCobolFiles', code: 'process-cobol-files' } as LogData]);
        await this.cobolProcessUtils.processCobolFiles(_id);
    }
}