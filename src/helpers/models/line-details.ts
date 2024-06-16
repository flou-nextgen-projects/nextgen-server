import Mongoose from "mongoose";

export default class LineDetails {
    lineIndex: number;
    parsedLine: string;
    originalLine: string;
    statementComment?: string;
    businessName?: string;
    referenceFileId?: Mongoose.Types.ObjectId | null | string = ""
    indicators?: Array<string|number>
};

export class FileStatics {
    lineCount: number = 0;
    processedLineCount: number = 0;
    parsed: boolean = false;
    exceptions: any = null;
};