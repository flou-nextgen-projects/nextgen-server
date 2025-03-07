import { ObjectId } from "mongodb";

export enum memberType {
    field = 1,
    property = 2,
    method = 3
}

function convertProperties(obj: any, fields: Array<string>): any {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
                obj[key] = obj[key].map((item: any) => convertProperties(item, fields));
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                obj[key] = convertProperties(obj[key], fields);
            } else if (fields.includes(key) && typeof obj[key] === 'string') {
                // we want to make id dynamic if it is a string and it's valid ObjectId or hexadecimal string
                if (obj[key].length === 24 && /^[0-9a-fA-F]{24}$/.test(obj[key]) && ObjectId.isValid(obj[key])) {
                    (obj[key] = new ObjectId(obj[key]));
                }
            }
        }
    }
    return obj;
}

function convertStringToObjectId(arr: any[], fields: Array<string> = ['_id', 'wid', 'pid', 'fid', 'memberId', 'methodId']): any[] {
    return arr.map((item) => convertProperties(item, fields));
}

export { convertStringToObjectId };