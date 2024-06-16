import { appService } from "../../services/app-service";
import Mongoose from "mongoose";
import { CobolMainProcessUtils } from "..";
import { ProjectMaster } from "../../models";

const cobolProcessUtils: CobolMainProcessUtils = new CobolMainProcessUtils();
export class CobolProcessStagesToExecute {
    static getStage = function (stageName: string): Function {
        return this[stageName];
    }
    public static getProject = async function (_id: string | Mongoose.Types.ObjectId): Promise<ProjectMaster> {
        return await appService.projectMaster.findById(_id);
    }
    static changeExtensionsStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        cobolProcessUtils.changeExtensions(project);
    };
    static processFileMasterDataStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processFileMasterData(project);
    }
    static processJCLFilesStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processJCLFiles(project);
    }
    static processCopyBookFilesStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processCopyBookFiles(project);
    }
    static processProcFilesStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processProcFiles(project);
    }
    static processBMSFilesStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processBMSFiles(project);
    }
    static processInputLibFilesStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processInputLibFiles(project);
    }
    static processSqlFilesStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processSqlFiles(project);
    }
    static processCobolFilesStage = async (_id: string | Mongoose.Types.ObjectId) => {
        const project = await this.getProject(_id);
        await cobolProcessUtils.processCobolFiles(project);
    }
}