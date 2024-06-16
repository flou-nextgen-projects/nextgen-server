import Mongoose, { Schema } from 'mongoose';
import { languageMasterVirtuals, workspaceMasterVirtuals } from '../virtuals';
import { EntityBase, LanguageMaster, WorkspaceMaster } from '../models';

enum ProcessingStatus {
    uploaded = 0,
    processing = 1,
    processed = 2,
    error = 3
}

interface UploadDetails {
    fileName: string;
    uploadPath: string;
    completePath: string;
}

interface ProjectMaster extends EntityBase {
    name: string;
    description?: string;
    wid: Mongoose.Types.ObjectId;
    lid?: Mongoose.Types.ObjectId | string;
    uploadedPath?: string;
    extractedPath?: string;
    isActive: boolean;
    uploadDetails: UploadDetails;
    uploadedOn?: Date;
    processedOn?: Date | null;
    totalObjects?: number;
    processingStatus: ProcessingStatus;
    languageMaster?: LanguageMaster;
    workspaceMaster?: WorkspaceMaster;
}

const ProjectMasterSchema: Schema<ProjectMaster> = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    }, description: {
        type: String,
        required: false
    }, wid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }, lid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }, uploadedPath: {
        type: String,
        default: ""
    }, extractedPath: {
        type: String,
        default: ""
    }, isActive: {
        type: Boolean,
        default: true
    }, uploadDetails: {
        fileName: {
            type: String
        },
        uploadPath: {
            type: String
        },
        completePath: {
            type: String
        }
    }, uploadedOn: {
        type: Date,
        required: false,
        default: new Date(),
        getDate: function (v: Date): string {
            if (typeof v === "undefined" || v === null) return null;
            return v.toLocaleDateString("en-us");
        },
        get: function (v: Date | any): string {
            if (typeof v === "undefined" || v === null) return null;
            return new Date(v).toLocaleDateString("en-us");
        }
    }, processedOn: {
        type: Date,
        required: false,
        default: null,
        getDate: function (v: Date): string {
            if (typeof v === "undefined" || v === null) return null;
            return v.toLocaleDateString("en-us");
        },
        get: function (v: Date | any): string {
            if (typeof v === "undefined" || v === null) return null;
            return new Date(v).toLocaleDateString("en-us");
        }
    }, totalObjects: {
        type: Number,
        required: false,
        default: 0
    }, processingStatus: {
        type: Mongoose.Schema.Types.Mixed,
        required: false,
        default: ProcessingStatus.uploaded,
        enum: Object.values(ProcessingStatus)
    }
});

ProjectMasterSchema.statics.useVirtuals = {
    languageMaster: languageMasterVirtuals,
    workspaceMaster: workspaceMasterVirtuals
} as any;

export { ProjectMasterSchema, ProjectMaster };
