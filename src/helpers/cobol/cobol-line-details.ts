import { ObjectId } from "mongodb";

export default class CobolLineDetails {
    public lineIndex: number;
    public originalLine: string;
    public modifiedLine: string;
    public indicators: Array<string | ObjectId> = [];
}