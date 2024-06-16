import mongoose, { Schema } from "mongoose";
import { languageMasterVirtuals } from "../virtuals";
import { EntityBase, LanguageMaster } from ".";

interface WorkspaceMaster extends EntityBase {
    lid: mongoose.Types.ObjectId;
    name: string;
    description?: string;
    languageMaster: LanguageMaster;
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
    }
});

WorkspaceMasterSchema.statics.useVirtuals = {
    languageMaster: languageMasterVirtuals
} as any;

export { WorkspaceMasterSchema, WorkspaceMaster };
