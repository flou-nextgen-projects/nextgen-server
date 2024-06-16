import Mongoose from "mongoose";
import EntityBase from "./entity-base";

const UniVerseFileMenuSchema: Mongoose.Schema<UniVerseFileMenuMaster> = new Mongoose.Schema({
    menuId: {
        type: String,
        trim: true,
        required: true,
        set: (v: string) => typeof v === "undefined" || v === null ? "" : v
    }, menuTitle: {
        type: String,
        trim: true,
        required: true,
        default: null,
        set: (v: string) => typeof v === "undefined" || v === null ? "" : v
    }, description: {
        type: String,
        trim: true,
        required: false,
        default: null,
        set: (v: string) => typeof v === "undefined" || v === null ? "" : v
    }, actionExecuted: {
        type: String,
        trim: true,
        required: false,
        default: null,
        set: (v: string) => typeof v === "undefined" || v === null ? "" : v
    }, userId: {
        type: Mongoose.Schema.Types.ObjectId,
        required: false,
        default: null
    }, pid: {
        type: Mongoose.Schema.Types.ObjectId,
        required: false,
        default: null
    }, uploadedOn: {
        type: Date,
        default: new Date(),
        get: function (v: Date) {
            return v.toLocaleDateString("en-us");
        }
    }
});

class UniVerseFileMenuMaster extends EntityBase {
    public menuId: string;
    public menuTitle: string;
    public description: string;
    public actionExecuted: string;
    public userId: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public uploadedOn: Date | string;
}

export { UniVerseFileMenuSchema, UniVerseFileMenuMaster };