import Mongoose, { Schema } from "mongoose";
import { fileTypeMasterVirtuals, projectMasterVirtuals } from "../virtuals";
import { EntityBase, FileTypeMaster, ProjectMaster } from "./";

interface FileStatics {
    lineCount: number;
    processedLineCount: number;
    parsed: boolean;
    exceptions: any;
}

interface FileMaster extends EntityBase {
    _id: Mongoose.Types.ObjectId | string;
    pid: Mongoose.Types.ObjectId | string;
    fileTypeId: Mongoose.Types.ObjectId | string;
    fileName: string;
    fileNameWithoutExt: string;
    filePath: string;
    processed: boolean;
    linesCount: number;
    workflowStatus: string;
    fileTypeMaster?: FileTypeMaster;
    projectMaster?: ProjectMaster;
    fileStatics: FileStatics;
}

const fileStaticsSchema: Schema<FileStatics> = new Schema({
    lineCount: Number,
    processedLineCount: Number,
    parsed: Boolean,
    exceptions: Mongoose.Schema.Types.Mixed
});

const FileMasterSchema: Schema<FileMaster> = new Schema({
    _id: {
        type: Mongoose.Schema.Types.ObjectId,
        required: false
    }, pid: {
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
    }, fileTypeMaster: {
        type: Mongoose.Types.ObjectId,
        ref: "fileTypeMaster",
        autopopulate: true
    }, projectMaster: {
        type: Mongoose.Types.ObjectId,
        ref: "projectMaster",
        autopopulate: true
    }, fileStatics: fileStaticsSchema
});

FileMasterSchema.statics.useVirtuals = {
    fileTypeMaster: fileTypeMasterVirtuals,
    projectMaster: projectMasterVirtuals
} as any;

export { FileMasterSchema, FileMaster };
