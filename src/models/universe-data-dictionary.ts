import Mongoose from "mongoose";
import { projectMasterVirtuals } from "../virtuals";
import { EntityBase, ProjectMaster } from "./";

const UniVerseDataDictionarySchema: Mongoose.Schema<UniVerseDataDictionary> = new Mongoose.Schema({
    rowId: {
        auto: true,
        type: Mongoose.Schema.Types.ObjectId,
        index: true
    }, fileName: {
        required: true,
        type: String
    }, fieldNo: {
        required: true,
        type: String
    }, description: {
        type: String,
        default: "",
        get: (v: string | null) => {
            return typeof v === "undefined" ? "" : v
        },
        set: (v: string | null) => typeof v === "undefined" ? "" : v
    }, fieldLabel: {
        type: String,
        default: "",
        get: (v: string | null) => {
            return typeof v === "undefined" ? "" : v
        },
        set: (v: string | null) => typeof v === "undefined" ? "" : v
    }, rptFieldLength: {
        type: String,
        default: "",
        get: (v: string | null) => {
            return typeof v === "undefined" ? "" : v
        },
        set: (v: string | null) => typeof v === "undefined" ? "" : v
    }, typeOfData: {
        type: String,
        default: "",
        get: (v: string | null) => {
            return typeof v === "undefined" ? "" : v
        },
        set: (v: string | null) => typeof v === "undefined" ? "" : v
    }, singleArray: {
        type: String,
        default: "",
        get: (v: string | null) => {
            return typeof v === "undefined" ? "" : v
        },
        set: (v: string | null) => typeof v === "undefined" ? "" : v
    }, dateOfCapture: {
        type: String,
        default: "",
        get: (v: string | null) => {
            return typeof v === "undefined" ? "" : v
        },
        set: (v: string | null) => typeof v === "undefined" ? "" : v
    }, replacementName: {
        required: true,
        type: String
    }, pid: {
        required: true,
        type: Mongoose.Schema.Types.ObjectId
    }
});

UniVerseDataDictionarySchema.statics.useVirtuals = {
    projectMaster: projectMasterVirtuals
} as any;

class UniVerseDataDictionary extends EntityBase {
    public rowId: Mongoose.Types.ObjectId | string;
    public fileName: string;
    public fieldNo: string;
    public description: string;
    public fieldLabel: string;
    public rptFieldLength: string;
    public typeOfData: string;
    public singleArray: string;
    public dateOfCapture: string;
    public replacementName: string;
    public pid: Mongoose.Types.ObjectId | string;
    public projectMaster: ProjectMaster | null;
}

export { UniVerseDataDictionarySchema, UniVerseDataDictionary };