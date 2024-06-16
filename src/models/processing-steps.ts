import Mongoose from "mongoose";
import EntityBase from "./entity-base";
var moment: any = require("moment");

const ProcessingStepSchema: Mongoose.Schema<ProcessingSteps> = new Mongoose.Schema({
    stepId: {
        auto: true,
        type: Mongoose.Schema.Types.ObjectId
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    }, stepName: {
        type: String,
        required: true,
        default: ""
    }, description: {
        type: String,
        required: true,
        default: ""
    }, startedOn: {
        type: Date,
        required: false,
        default: null,
        get: function (v: Date) {
            if (typeof v === "undefined" || v === null) return null;
            var mom = moment(v).format("MM/DD/YYYY hh:mm:ss A");
            return mom;
        }
    }, completedOn: {
        type: Date,
        required: false,
        default: null,
        get: function (v: Date) {
            if (typeof v === "undefined" || v === null) return null;
            var mom = moment(v).format("MM/DD/YYYY hh:mm:ss A");
            return mom;
        }
    }, canReprocess: {
        type: Boolean,
        default: false
    }, processDetails: {
        TableName: {
            type: String,
            required: false,
            default: ""
        }
    }
});

class ProcessingSteps extends EntityBase {
    public stepId: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public stepName: string;
    public description: string;
    public startedOn: Date;
    public completedOn: Date;
    public canReprocess: boolean;
    public processDetails: {
        tableName: string | null | '';
    }
};

export { ProcessingStepSchema, ProcessingSteps };