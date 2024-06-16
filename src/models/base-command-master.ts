import Mongoose from "mongoose";
import EntityBase from "./entity-base";

const BaseCommandMasterSchema: Mongoose.Schema<BaseCommandMaster> = new Mongoose.Schema({
    id: {
        type: Number, required: true
    }, description: {
        type: String, require: true
    }, shortName: {
        type: String, require: true
    }
});


class BaseCommandMaster extends EntityBase {
    public id: number;
    public description: string;
    public shortName: string;
}

export { BaseCommandMasterSchema, BaseCommandMaster };