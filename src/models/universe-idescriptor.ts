import Mongoose from "mongoose";
import { projectMasterVirtuals } from "../virtuals";
import { ProjectMaster } from "./project-master";
import EntityBase from "./entity-base";

const UniVerseDescriptorSchema: Mongoose.Schema<UniVerseDescriptorMaster> = new Mongoose.Schema({
    descriptorId: {
        type: Mongoose.Schema.Types.ObjectId,
        required: false,
        auto: true
    }, entity: {
        type: String,
        required: true,
        trim: true
    }, storedProcedureName: {
        type: String,
        required: true,
        trim: true
    }, type: {
        type: String,
        required: false,
        default: "",
        trim: true
    }, defaultReportDisplayHeading: {
        type: String,
        required: false,
        default: "",
        trim: true
    }, defaultFormatting: {
        type: String,
        required: false,
        default: "",
        trim: true
    }, defaultConversion: {
        type: String,
        required: false,
        default: "",
        trim: true
    }, valuedAssociation: {
        type: String,
        required: false,
        default: "",
        trim: true
    }, longDescription: {
        type: String,
        required: false,
        default: "",
        trim: true
    }, statementString: {
        type: String,
        required: false,
        default: "",
        trim: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }
});

UniVerseDescriptorSchema.statics.useVirtuals = {
    projectMaster: projectMasterVirtuals
} as any;

class UniVerseDescriptorMaster extends EntityBase {
    public descriptorId: Mongoose.Types.ObjectId | string;
    public entity: string;
    public storedProcedureName: string;
    public type: string;
    public defaultReportDisplayHeading: string;
    public defaultFormatting: string;
    public defaultConversion: string;
    public valuedAssociation: string;
    public longDescription: string;
    public statementString: string;
    public pid: Mongoose.Types.ObjectId | string;
    public projectMaster: ProjectMaster;
} export { UniVerseDescriptorSchema, UniVerseDescriptorMaster };