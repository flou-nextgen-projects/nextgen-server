import Mongoose, { Schema } from "mongoose";
import EntityBase from "./entity-base";
import { FileMaster } from ".";

class MissingObjects extends EntityBase {
    public fid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public fromObject: string;
    public statement: string;
    public type: string;
    public calledObject: string;
}
const MissingObjectsSchema: Schema<MissingObjects> = new Schema({
    fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, fromObject: {
        type: String, required: true
    }, statement: {
        type: String, required: true, default: ''
    }, type: {
        type: String, required: true, default: ''
    }, calledObject: {
        type: String, required: true, default: ''
    }
});

class CobolEntities extends EntityBase {
    public fid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public entityName: string;
    public alternateEntityName: string;
    public fileMaster?: FileMaster; // Assuming FileMaster is another class
}


class CobolVariables extends EntityBase {
    public start: number;
    public end: number;
    public entityId: Mongoose.Types.ObjectId | string;
    public sectionId: number;
    public sectionName: string;
    public variableName: string;
    public variableLevel: string;
    public dataTypeField: string;
    public defaultValue: string;
    public fid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public pictureClause: string;
    public computationOrBinary: string;
    public length: string;
    public dataType: string;
    public parentId: string;
    public graphId: string;
    public alternateName: string;
    public statement: string;
    public cobolEntities?: CobolEntities; // Assuming CobolEntities is another class
}

const CobolVariableSchema: Mongoose.Schema<CobolVariables> = new Mongoose.Schema({
    start: {
        type: Number, required: true
    }, end: {
        type: Number, required: true
    }, entityId: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, sectionId: {
        type: Number, required: true
    }, sectionName: {
        type: String, required: true, default: ""
    }, variableName: {
        type: String, required: true, default: ""
    }, variableLevel: {
        type: String, required: true, default: ""
    }, dataTypeField: {
        type: String, required: true, default: ""
    }, defaultValue: {
        type: String, required: true, default: ""
    }, fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, pictureClause: {
        type: String, required: true, default: ""
    }, computationOrBinary: {
        type: String, required: true, default: ""
    }, length: {
        type: String, required: true, default: ""
    }, dataType: {
        type: String, required: true, default: ""
    }, parentId: {
        type: String, required: true, default: ""
    }, graphId: {
        type: String, required: true, default: ""
    }, alternateName: {
        type: String, required: true, default: ""
    }, statement: {
        type: String, required: true, default: ""
    }, cobolEntities: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: 'cobolEntities',
        required: false
    }
});

const CobolEntitiesSchema: Mongoose.Schema<CobolEntities> = new Mongoose.Schema({
    fid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId, required: true
    }, entityName: {
        type: String, required: true, default: ""
    }, alternateEntityName: {
        type: String, required: true, default: ""
    }, fileMaster: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: 'fileMaster',
        required: false
    }
});

export const CobolEntitiesModel = Mongoose.model<CobolEntities>('CobolEntities', CobolEntitiesSchema);


export { MissingObjects, MissingObjectsSchema, CobolEntities, CobolVariableSchema, CobolVariables, CobolEntitiesSchema }