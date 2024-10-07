import { FileMaster } from ".";
import EntityBase from "./entity-base";
import Mongoose from "mongoose";

class EntityMaster extends EntityBase {
    public entityName: string;
    public pid: Mongoose.Types.ObjectId | string;
    public fid: Mongoose.Types.ObjectId | string;
}
const EntityMasterSchema: Mongoose.Schema<EntityMaster> = new Mongoose.Schema({
    entityName: {
        type: String, required: true, default: ""
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }
});
class DataDependency extends EntityBase {
    public entity: string;
    public attributes: string;
    public pid: Mongoose.Types.ObjectId | string;
    public fid: Mongoose.Types.ObjectId | string;
    public fileMaster?: FileMaster;    
}
const DataDependencySchema: Mongoose.Schema<DataDependency> = new Mongoose.Schema({
    pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, entity: {
        type: String, required: true
    }, attributes: {
        type: String, required: false
    }, fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, fileMaster: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: 'fileMaster',
        required: false
    }
});

class EntityAttributes extends EntityBase {
    public rowId: number;
    public pid: Mongoose.Types.ObjectId | string;
    public eid: Mongoose.Types.ObjectId | string;
    public entityName: string;
    public attributeName: string;
    public dataType: string;
    public dataLength: string;
    public storeEntitySet: string;
}

const EntityAttributesSchema: Mongoose.Schema<EntityAttributes> = new Mongoose.Schema({
    rowId: {
        type: Number, required: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, eid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, entityName: {
        type: String, required: true, default: ""
    }, attributeName: {
        type: String, required: true, default: ""
    }, dataType: {
        type: String, required: true, default: ""
    }, dataLength: {
        type: String, required: true, default: ""
    }, storeEntitySet: {
        type: String, required: true, default: ""
    }
});

export { EntityMaster, EntityMasterSchema, DataDependency, DataDependencySchema, EntityAttributes, EntityAttributesSchema };