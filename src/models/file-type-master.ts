import Mongoose from "mongoose";
import { languageMasterVirtuals } from "../virtuals";
import { EntityBase, LanguageMaster } from "./";

// Or using Intersection type
class FileTypeMaster extends EntityBase {
    constructor() { super(); }
    public fileTypeName: string;
    public fileTypeExtension: string;
    public img: string;
    public delimiter?: string;
    public color: string;
    public folderNames: string[];
    public lid: Mongoose.Types.ObjectId | string;
    public languageMaster: LanguageMaster;
}

const FileTypeMasterSchema: Mongoose.Schema<FileTypeMaster> = new Mongoose.Schema({
    fileTypeName: { type: String, required: true, trim: true },
    fileTypeExtension: { type: String, required: true, lowercase: true, trim: true },
    img: { type: String, required: true, trim: true, lowercase: true },
    delimiter: { type: String, required: false, trim: true },
    color: { type: String, required: true },
    folderNames: { type: [String], required: true, set: (folderNames: string[]) => [...new Set(folderNames.map(folder => folder.toLowerCase()))] },
    lid: {
        required: true,
        set: function (value: Mongoose.Types.ObjectId | string) {
            return typeof value === 'string' && Mongoose.Types.ObjectId.isValid(value) ? new Mongoose.Types.ObjectId(value) : value;
        },
        get: function (value: Mongoose.Types.ObjectId | string) {
            return value;
        },
        type: Mongoose.Schema.Types.ObjectId
    }, createdBy: {
        type: Mongoose.Schema.Types.ObjectId,
        auto: false,
        required: false
    }, createdOn: {
        type: Date,
        required: false,
        auto: true,
        default: new Date()
    }, updatedOn: {
        type: Date,
        required: false,
        auto: true,
        default: new Date()
    }
});

FileTypeMasterSchema.statics.useVirtuals = {
    languageMaster: languageMasterVirtuals
} as any;

export { FileTypeMasterSchema, FileTypeMaster };
