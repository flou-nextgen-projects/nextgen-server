import mongoose, { Schema } from "mongoose";
import { languageMasterVirtuals } from "../virtuals";
import { EntityBase, LanguageMaster } from ".";

class WorkspaceMaster extends EntityBase {
    public lid: Schema.Types.ObjectId | string;
    public name: string;
    public description?: string;
    public dirPath?: string;
    public physicalPath?: string;
    public languageMaster?: LanguageMaster;
}

const WorkspaceMasterSchema: Schema<WorkspaceMaster> = new Schema({
    lid: {
        type: Schema.Types.ObjectId,
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
    }
});

WorkspaceMasterSchema.statics.useVirtuals = {
    languageMaster: languageMasterVirtuals
} as any;

export { WorkspaceMasterSchema, WorkspaceMaster };
