import Mongoose from "mongoose"
import { LogData, WinstonLogger } from "nextgen-utilities";
import { ProjectMaster } from "../../models";
import { appService } from "../../services/app-service";
import PlSqlMainProcessUtils from "./pl-sql-main-process-utils";

export class PlSqlProcessToExecute {
    public pid: string | Mongoose.Types.ObjectId;
    public logger: WinstonLogger;
    public sqlMainProcessUtils: PlSqlMainProcessUtils = new PlSqlMainProcessUtils();
    constructor(_id: string | Mongoose.Types.ObjectId) {
        this.pid = _id;
        this.logger = new WinstonLogger(__filename);
    }
    public get = function (name: string): Function {
        return this[name];
    }
    public getProject = async function (_id: string | Mongoose.Types.ObjectId): Promise<ProjectMaster> {
        return await appService.projectMaster.findById(_id);
    }
    public processFileMasterData = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processFileMasterData for project: ${_id}`, { name: 'processFileMasterData', code: 'process-file-master-data' } as LogData]);
        await this.sqlMainProcessUtils.processFileMasterData(_id);
    }
    public dumpFileContents = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started dumpFileContents process for project: ${_id}`, { name: 'dumpFileContents', code: 'dump-file-master-data' } as LogData]);
        await this.sqlMainProcessUtils.dumpFileContents(_id);
    }
    public processPlSqlFiles = async (_id: string | Mongoose.Types.ObjectId) => {
        this.logger.debug.apply(this, [`Started processPlSqlFiles process for project: ${_id}`, { name: 'processPlSqlFiles', code: 'process-PLSQL-files' } as LogData]);
        await this.sqlMainProcessUtils.processPlSqlFiles(_id);
    }
}