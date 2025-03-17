import Mongoose, { Schema } from "mongoose";
import EntityBase from "./entity-base";

class CobolDataSet extends EntityBase {
    public dataSetId: number;
    public fid: Mongoose.Types.ObjectId | string;
    public referenceFileId: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public leftVariable: string;
    public rightVariable: string;
    public calledObjectName: string;
    public dsnValue: string;
    public type: string;
}

const CobolDataSetSchema: Schema<CobolDataSet> = new Schema({
    dataSetId: {
        type: Number, required: true
    }, fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, referenceFileId: {
        type: Mongoose.Schema.Types.ObjectId, required: false
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, leftVariable: {
        type: String, required: true, default: ""
    }, rightVariable: {
        type: String, required: true, default: ""
    }, calledObjectName: {
        type: String, required: false
    }, dsnValue: {
        type: String, required: true, default: ""
    }, type: {
        type: String, required: true
    }
});
class BmsMapMaster extends EntityBase {
    public fid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public map: string;
    public mapSet: string;
}
const BmsMapMasterSchema: Schema<BmsMapMaster> = new Schema({
    fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, map: {
        type: String, required: true, default: ''
    }, mapSet: {
        type: String, required: true, default: ''
    }
});
class BmsMapControl extends EntityBase {
    public fid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public bmsMapId: Mongoose.Types.ObjectId | string;
    public controlName: string;
    public xPos: string;
    public yPos: string;
    public length: string;
    public color: string;
    public initialValue: string;
    public isProt: string;
    public attributes: string;
}
const BmsMapControlSchema: Schema<BmsMapControl> = new Schema({
    fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, bmsMapId: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, controlName: {
        type: String, required: true, default: ''
    }, xPos: {
        type: String, required: true, default: ''
    }, yPos: {
        type: String, required: true, default: ''
    }, length: {
        type: String, required: true, default: ''
    }, color: {
        type: String, required: true, default: ''
    }, initialValue: {
        type: String, required: true, default: ''
    }, isProt: {
        type: String, required: true, default: ''
    }, attributes: {
        type: String, required: true, default: ''
    }
});
class ExternalCalls extends EntityBase {
    public fid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public statement: string;
    public copyBookFileId: Mongoose.Types.ObjectId | string;
    public methodCalled: string;
}
const ExternalCallsSchema: Schema<ExternalCalls> = new Schema({
    fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, copyBookFileId: {
        type: Mongoose.Schema.Types.ObjectId, required: false
    }, statement: {
        type: String, required: true, default: ''
    }, methodCalled: {
        type: String, required: true, default: ''
    }
});

export { ExternalCalls, ExternalCallsSchema, CobolDataSetSchema, CobolDataSet, BmsMapMaster, BmsMapMasterSchema, BmsMapControl, BmsMapControlSchema };
