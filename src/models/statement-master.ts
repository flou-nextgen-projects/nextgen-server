import Mongoose from "mongoose";
import EntityBase from "./entity-base";

class StatementMaster extends EntityBase {
    public fid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public lineIndex: number;
    public indicators: Array<string | number>;
    public originalLine: string;
    public modifiedLine: string;
    public alternateName: string;
    public methodName: string;
    public classNameDeclared: string;
    public referenceFileId: Mongoose.Types.ObjectId | string;
    public annotatedLine: string;
    public classCalled: string;
    public methodCalled: string;
    public businessName: string;
}
const StatementSchema: Mongoose.Schema<StatementMaster> = new Mongoose.Schema<StatementMaster>({
    fid: {
        required: true, type: Mongoose.Schema.Types.ObjectId, select: true
    }, pid: {
        required: true, type: Mongoose.Schema.Types.ObjectId, select: true
    }, referenceFileId: {
        required: false, type: Mongoose.Schema.Types.ObjectId, select: true, sparse: true
    }, lineIndex: {
        type: Number, required: true, select: true
    }, indicators: {
        type: Array<String | Number>, required: false
    }, originalLine: {
        type: String, required: true, select: true
    }, modifiedLine: {
        type: String, required: true, select: true
    }, alternateName: {
        type: String, required: false, select: true, sparse: true
    }, methodName: {
        type: String, required: false, select: true, sparse: true
    }, methodCalled: {
        type: String, required: false, select: true, sparse: true
    }, classNameDeclared: {
        type: String, required: false, select: true, sparse: true
    }, classCalled: {
        type: String, required: false, select: true, sparse: true
    }, annotatedLine: {
        type: String, required: false, select: true, sparse: true
    }, businessName: {
        type: String, required: false, select: true, sparse: true
    }
});

export { StatementMaster, StatementSchema };