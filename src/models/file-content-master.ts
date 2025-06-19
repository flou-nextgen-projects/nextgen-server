import Mongoose from "mongoose";
import { fileMasterVirtuals } from "../virtuals";
import { EntityBase, FileMaster } from ".";

const FileContentMasterSchema: Mongoose.Schema<FileContentMaster> = new Mongoose.Schema({
    pid: { required: true, type: Mongoose.Schema.Types.ObjectId },
    fid: { required: true, type: Mongoose.Schema.Types.ObjectId },
    wid: { required: true, type: Mongoose.Schema.Types.ObjectId },
    methodId: { required: true, type: Mongoose.Schema.Types.ObjectId },
    original: { required: false, type: String },
    formatted: { required: false, type: String }
});

FileContentMasterSchema.statics.useVirtuals = {
    fileMaster: fileMasterVirtuals
} as any;

class FileContentMaster extends EntityBase {
    public pid: Mongoose.Types.ObjectId | string;
    public fid: Mongoose.Types.ObjectId | string;
    public wid: Mongoose.Types.ObjectId | string;
    public methodId: Mongoose.Types.ObjectId | string;
    public original: string;
    public formatted: string;
    public fileMaster?: FileMaster;
}

export { FileContentMasterSchema, FileContentMaster };