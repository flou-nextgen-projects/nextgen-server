import Mongoose from "mongoose";

export default class EntityBase extends Mongoose.Document {  
    public declare _id: Mongoose.Types.ObjectId | string;
    private _createdOn: Date;
    private _updatedOn: Date;
    public createdBy: string | Mongoose.Types.ObjectId;

    constructor() {
        super();
        this._createdOn = new Date();
        this._updatedOn = new Date();
        this.createdBy = '';
    }

    get createdOn(): Date {
        return this._createdOn;
    }

    set createdOn(value: Date) {
        this._createdOn = value;
    }

    get updatedOn(): Date {
        return this._updatedOn;
    }

    set updatedOn(value: Date) {
        this._updatedOn = value;
    }
}