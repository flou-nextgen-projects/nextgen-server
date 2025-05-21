import Mongoose from "mongoose";
import { languageMasterVirtuals } from "../virtuals";
import { EntityBase, LanguageMaster } from ".";

class WorkspaceMaster extends EntityBase {
    public lid: Mongoose.Types.ObjectId | string;
    public name: string;
    public description?: string;
    public dirPath?: string;
    public physicalPath?: string;
    public languageMaster?: LanguageMaster;
    public uploadedOn?: Date;
    public processedOn?: Date | null;
}

const WorkspaceMasterSchema: Mongoose.Schema<WorkspaceMaster> = new Mongoose.Schema({
    lid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }, name: {
        type: String,
        required: true,
        unique: true
    }, description: {
        required: false,
        type: String
    }, dirPath: {
        required: false,
        type: String
    }, physicalPath: {
        required: false,
        type: String
    },
    uploadedOn: {
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
        default: new Date(),
        getDate: function (v: Date): string {
            if (typeof v === "undefined" || v === null) return null;
            return v.toLocaleDateString("en-us");
        },
        get: function (v: Date | any): string {
            if (typeof v === "undefined" || v === null) return null;
            return new Date(v).toLocaleDateString("en-us");
        }
    }
});

WorkspaceMasterSchema.statics.useVirtuals = {
    languageMaster: languageMasterVirtuals
} as any;

export { WorkspaceMasterSchema, WorkspaceMaster };
