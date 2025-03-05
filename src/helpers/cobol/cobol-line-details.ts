import { ObjectId } from "mongodb";

export default class CobolLineDetails {
    public location: number;
    public originalLine: string;
    public modifiedLine: string;
    public indicators: Array<string | ObjectId> = [];
}