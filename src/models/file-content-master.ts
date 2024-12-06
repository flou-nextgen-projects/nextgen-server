import Mongoose from "mongoose";
import { fileMasterVirtuals } from "../virtuals";
import { EntityBase, FileMaster } from ".";

const FileContentMasterSchema: Mongoose.Schema<FileContentMaster> = new Mongoose.Schema({
    fid: {
        required: true,
        type: Mongoose.Schema.Types.ObjectId
    }, fileContent: {
        required: false,
        type: String
    }, contentWithoutComments: {
        required: false,
        type: String
    }
});

FileContentMasterSchema.statics.useVirtuals = {
    fileMaster: fileMasterVirtuals
} as any;

class FileContentMaster extends EntityBase {
    public fid: Mongoose.Types.ObjectId | string;
    public fileContent: string;
    public contentWithoutComments: string;
    public fileMaster?: FileMaster;
}

export { FileContentMasterSchema, FileContentMaster };