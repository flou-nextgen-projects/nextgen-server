import Mongoose from "mongoose";
import { projectMasterVirtuals } from "../virtuals";
import { EntityBase, ProjectMaster } from "./";

const ProjectDirInfoSchema: Mongoose.Schema<ProjectDirInfo> = new Mongoose.Schema({
    pid: {
        required: true, type: Mongoose.Schema.Types.ObjectId
    }, rootPath: {
        required: true, type: String
    }, dirName: {
        required: true, type: String
    }, dirCompletePath: {
        required: true, type: String
    }
});

ProjectDirInfoSchema.statics.useVirtuals = {
    projectMaster: projectMasterVirtuals
} as any;

class ProjectDirInfo extends EntityBase {
    public pid: Mongoose.Types.ObjectId | string;
    public rootPath: string;
    public dirName: string;
    public dirCompletePath: string;
    public projectMaster: ProjectMaster;
};

export { ProjectDirInfoSchema, ProjectDirInfo };