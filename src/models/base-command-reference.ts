import Mongoose from "mongoose";
import { languageMasterVirtuals, fileTypeMasterVirtuals } from "../virtuals";
import { LanguageMaster, FileTypeMaster, EntityBase } from ".";

const BaseCommandRefSchema: Mongoose.Schema<BaseCommandReference> = new Mongoose.Schema({
    lid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }, fileTypeId: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, classStart: {
        required: false, type: String
    }, classEnd: {
        required: false, type: String
    }, ifBlock: {
        start: {
            required: true, type: [String]
        }, elseBlock: {
            required: true, type: [String]
        }, end: { required: true, type: [String] }
    }, callInternals: {
        required: true, type: [String]
    }, callExternals: {
        required: false, type: [String]
    }, loop: {
        start: {
            required: true, type: [String]
        }, end: { required: true, type: [String] }
    }, methodOrParagraph: {
        start: {
            required: false, type: [String]
        }, end: { required: false, type: [String] }
    }, blockComment: {
        start: {
            type: String, required: false, trim: true
        }, end: { type: String, required: false, trim: true }
    }, lineComment: {
        type: String, required: true, trim: true, default: "*"
    }, commentWithinLine: {
        type: String, required: false, trim: true, default: "; *"
    }
});

BaseCommandRefSchema.statics.useVirtuals = {
    languageMaster: languageMasterVirtuals,
    fileTypeMaster: fileTypeMasterVirtuals
} as any;

class BaseCommandReference extends EntityBase {
    public lid: Mongoose.Types.ObjectId | string;
    public fileTypeId: Mongoose.Types.ObjectId | string;
    public classStart: string;
    public classEnd: string;
    public ifBlock: { start: [string], elseBlock: [string], end: [string] };
    public callInternals: Array<string>;
    public callExternals: Array<string>;
    public loop: { start: Array<string>, end: Array<string> } = { start: [], end: [] };
    public methodOrParagraph: { start: [string], end: [string] };
    public blockComment: { start: string, end: string };
    public lineComment: string;
    public commentWithinLine: string;
    public lineBreakElement: string = "_";
    // public options: { startsWith: boolean, contains: boolean, endsWith: boolean, regex: RegExp | string, keywords: Array<string> };
    public languageMaster: LanguageMaster;
    public fileTypeMaster: FileTypeMaster;
}

export { BaseCommandRefSchema, BaseCommandReference };