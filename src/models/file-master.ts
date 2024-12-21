import Mongoose, { Schema } from "mongoose";
import { fileTypeMasterVirtuals, projectMasterVirtuals } from "../virtuals";
import { EntityBase, FileTypeMaster, ProjectMaster } from "./";

interface FileStatics {
    lineCount: number;
    processedLineCount: number;
    parsed: boolean;
    exceptions: any;
}

class FileMaster extends EntityBase {    
    public pid: Mongoose.Types.ObjectId | string;
    public fileTypeId: Mongoose.Types.ObjectId | string;
    public fileName: string;
    public fileNameWithoutExt: string;
    public filePath: string;
    public processed: boolean;
    public linesCount: number;
    public workflowStatus: string;
    public fileTypeMaster?: FileTypeMaster;
    public projectMaster?: ProjectMaster;
    public fileStatics: FileStatics;
}

const fileStaticsSchema: Schema<FileStatics> = new Schema({
    lineCount: Number,
    processedLineCount: Number,
    parsed: Boolean,
    exceptions: Mongoose.Schema.Types.Mixed
});

const FileMasterSchema: Schema<FileMaster> = new Schema({
    pid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }, fileTypeId: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }, fileName: {
        type: String,
        trim: true,
        required: true
    }, fileNameWithoutExt: {
        type: String,
        trim: true,
        required: true
    }, filePath: {
        type: String,
        required: true,
        trim: true
    }, processed: {
        type: Boolean,
        default: false,
        required: false
    }, linesCount: {
        type: Number,
        default: 0,
        required: false
    }, workflowStatus: {
        type: String,
        required: false,
        sparse: true
    }, fileStatics: fileStaticsSchema
});

FileMasterSchema.statics.useVirtuals = {
    fileTypeMaster: fileTypeMasterVirtuals,
    projectMaster: projectMasterVirtuals
} as any;

export { FileMasterSchema, FileMaster };
