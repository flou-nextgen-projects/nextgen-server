import { ObjectId } from "mongodb";
import Mongoose from "mongoose";

export enum memberType {
    field = 1,
    property = 2,
    method = 3
}

function convertProperties(obj: any): any {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (obj[key] && typeof obj[key] === "object" && '$oid' in obj[key]) {
                obj[key] = Mongoose.Types.ObjectId.createFromHexString(obj[key]['$oid']);
            } else if (Array.isArray(obj[key])) {
                obj[key] = obj[key].map((item: any) => convertProperties(item));
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                obj[key] = convertProperties(obj[key]);
            } else if (obj[key] && obj[key].length === 24 && /^[0-9a-fA-F]{24}$/.test(obj[key]) && ObjectId.isValid(obj[key])) {
                (obj[key] = Mongoose.Types.ObjectId.createFromHexString(obj[key]));
            }
        }
    }
    return obj;
}

function convertStringToObjectId(arr: any[]): any[] {
    return arr.map((item) => convertProperties(item));
}

export { convertStringToObjectId };