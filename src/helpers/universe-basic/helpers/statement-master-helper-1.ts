import fs from "fs";
import { LineDetails, FileStatics } from "../../models";
import { StatementMaster, FileMaster, FileContentMaster, BaseCommandReference, BaseCommandMaster } from "../../../models";
import { appService } from "../../../services/app-service";
import { universeStringExtensions, universeUtilities, universeArrayExtensions } from "../../../helpers";

export class StatementReferenceMasterHelper {
    constructor() { };
    prepareStatementReferenceMaster = (lineDetail: LineDetails, baseCommandRef: BaseCommandMaster, fileMaster: FileMaster): StatementMaster => {
        try {
            const statementReferenceMaster = Object.assign({}, {
                originalLine: lineDetail.originalLine,
                modifiedLine: lineDetail.parsedLine,
                statementComment: lineDetail.statementComment,
                // TODO: need to check this later
                // id: bcReference.id === 0 ? null : bcReference._id,
                fid: fileMaster._id,
                pid: fileMaster.pid,
                // methodName: bcReference.aseCommandId === 8 ? lineDetail.parsedLine : "",
                // businessName: bcReference.id === 8 ? lineDetail.businessName : "",
                referenceFileId: lineDetail.referenceFileId,
                alternateName: null
            });
            return statementReferenceMaster as unknown as StatementMaster;
        } catch (error) {
            console.log(error);
        }
    };
    getMethodBusinessName = function (lineDetail: LineDetails, fileContents: string[], lineComment: string): LineDetails {
        const location = lineDetail.location;
        if (location <= 0) return lineDetail;
        var businessName = "";
        for (var index = location; index >= location - 4; index--) {
            const line = fileContents[index].trim();
            if (/^[\*\s]+$/.test(line)) continue;
            if (!line.startsWith(lineComment)) continue;
            businessName = line.split(lineComment).reverse().shift().trim();
            break;
        }
        lineDetail.businessName = businessName;
        return lineDetail;
    };
    extractBaseCommandId = (trimedStatement: string, bcReference: BaseCommandReference, baseCommands: BaseCommandMaster[]): BaseCommandMaster | null => {
        if (universeStringExtensions.checkStatement(trimedStatement)) return null;

        const ifPattern = bcReference.ifBlock.start.join("|");
        const callExtPattern = bcReference.callExternals.join("|");
        const loopStartPattern = bcReference.loop.start.join("|");
        const endIfPattern = bcReference.ifBlock.end.join("|");
        const loopEndPattern = bcReference.loop.end.join("|");
        const elseBlockPattern = bcReference.ifBlock.elseBlock.join("|");
        const callIntPattern = bcReference.callInternals.join("|");
        const methodStartPattern = bcReference.methodOrParagraph.start.join("|");
        const methodEndPattern = bcReference.methodOrParagraph.end.join("|");

        var regExEndIf = new RegExp(endIfPattern, "ig");
        var regExLoopStart = new RegExp(loopStartPattern, "ig");
        var regExLoopEnd = new RegExp(loopEndPattern, "ig");
        var regExIfStart = new RegExp(ifPattern, "ig");
        var regExElse = new RegExp(elseBlockPattern, "ig");
        var regExCallExt = new RegExp(callExtPattern, "ig");
        var regExCallInt = new RegExp(callIntPattern, "ig");
        const regExMethodStart = new RegExp(methodStartPattern, "ig");
        const regExMethodEnd = new RegExp(methodEndPattern, "ig");

        var baseCommand: BaseCommandMaster = regExIfStart.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "is") : { id: 0, shortName: "", _id: null } as BaseCommandMaster;
        baseCommand = regExLoopStart.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "ls") : baseCommand;
        baseCommand = regExLoopEnd.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "le") : baseCommand;
        baseCommand = regExEndIf.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "ie") : baseCommand;
        baseCommand = regExElse.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "eb") : baseCommand;
        baseCommand = regExCallExt.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "ce") : baseCommand;
        baseCommand = regExCallInt.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "ci") : baseCommand;
        baseCommand = regExMethodStart.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "ms") : baseCommand;
        baseCommand = regExMethodEnd.test(trimedStatement) ? baseCommands.find(bc => bc.shortName === "me") : baseCommand;

        return baseCommand;
    };
    printFileStatics = function (lstBaseCommands: BaseCommandMaster[], fileMaster: any) {
        console.log("==========================================================");
        const ifCount = lstBaseCommands.filter(b => b.id === 1);
        const endIfCount = lstBaseCommands.filter(b => b.id === 2);
        const callExtCount = lstBaseCommands.filter(b => b.id === 6);
        const callIntCount = lstBaseCommands.filter(b => b.id === 5);
        const elseCount = lstBaseCommands.filter(b => b.id === 10);
        const methodStartCount = lstBaseCommands.filter(b => b.id === 8);
        const methodEndCount = lstBaseCommands.filter(b => b.id === 9);
        console.log({
            "If Statements: ": ifCount.length,
            "End If Statements: ": endIfCount.length,
            "Else Statements: ": elseCount.length,
            "Call External Statements: ": callExtCount.length,
            "Call Internal Statements: ": callIntCount.length,
            "Method Start Statements: ": methodStartCount.length,
            "Method End Statements: ": methodEndCount.length,
            "File Name: ": fileMaster.FileName,
            "Type: ": fileMaster.FileTypeMaster.FileTypeName
        });
        console.log("==========================================================");
    };
    matchAll = function* (inputString: string, regExp: RegExp) {
        const flags = regExp.global ? regExp.flags : regExp.flags + "g";
        const regularExpression = new RegExp(regExp, flags);
        let match: RegExpExecArray;
        while (match = regularExpression.exec(inputString)) {
            yield match;
        }
    };
    extractUniVerseFileName = (lineDetail: LineDetails): string => {
        var callRegEx = new RegExp(/^CALL\s+(.*?(?=\())/, "ig");
        var phExePhantomRegEx = new RegExp(/^[EXECUTE\s+|PH\s+|PHANTOM\s+]+(.*)/, "ig");
        var includeInsertRegEx = new RegExp(/([a-zA-Z0-9\.\\_]+$)/, "ig");
        var runRegEx = new RegExp(/^(RUN\s+)/, "ig");

        if (callRegEx.test(lineDetail.parsedLine)) {
            let matches = this.matchAll(lineDetail.parsedLine, callRegEx);
            let matchedValue = Array.from(matches, values => values.reverse().shift()).shift();
            var fileName = matchedValue.trim().replace('@', '').trim();
            return fileName;
        }
        if (includeInsertRegEx.test(lineDetail.parsedLine) && !runRegEx.test(lineDetail.parsedLine) && !phExePhantomRegEx.test(lineDetail.parsedLine)) {
            let matches = this.matchAll(lineDetail.parsedLine, includeInsertRegEx);
            let matchedValue = Array.from(matches, values => values.reverse().shift()).shift();
            var fileName = matchedValue.trim();
            return fileName;
        }
        if (phExePhantomRegEx.test(lineDetail.parsedLine)) {
            let matches = this.matchAll(lineDetail.parsedLine, phExePhantomRegEx);
            let matchedValue = Array.from(matches, values => values.reverse().shift()).shift();
            var fileName = matchedValue.trim();
            return fileName;
        }
        if (!runRegEx.test(lineDetail.parsedLine)) return "";

        var trySplit = lineDetail.parsedLine.split(" ");
        if (trySplit.length <= 2) return "";

        var objectName = trySplit.slice(2).shift().trim();
        return objectName;
    };
    processUniVerseFile = (baseCommands: BaseCommandMaster[], bcReference: BaseCommandReference, fileMaster: FileMaster) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            if (!fs.existsSync(fileMaster.filePath)) resolve();
            const lineBreakElement: string = bcReference.lineBreakElement || "_";
            const fileContent: string = fs.readFileSync(fileMaster.filePath).toString();
            var fileContentLines: string[] = fileContent.split("\n");
            var lineDetails: Array<LineDetails> = universeArrayExtensions.removeCommentedAndBlankLines(fileContentLines, bcReference.lineComment);
            const contentLines: Array<LineDetails> = universeArrayExtensions.combineAllBrokenLines(lineDetails, lineBreakElement);
            const fileLinesArray: Array<LineDetails> = universeUtilities.processLocateStatements(contentLines);
            let fileLineDetails: Array<LineDetails> = universeUtilities.processCaseStatements(fileLinesArray);
            const lstBaseCommands: BaseCommandMaster[] = [];
            const lstStatementReferenceMaster: Array<StatementMaster> = [];
            for (const contentLine of fileLineDetails) {
                const baseCommandMaster: BaseCommandMaster = this.extractBaseCommandId(contentLine.parsedLine, bcReference, baseCommands);
                var lineDetail: LineDetails = universeStringExtensions.getCommentAndStatement(contentLine);
                const methodRegExp = new RegExp(bcReference.methodOrParagraph.start.join("|"), "ig");
                if (methodRegExp.test(contentLine.parsedLine)) {
                    lineDetail = this.getMethodBusinessName(lineDetail, fileContentLines, bcReference.lineComment);
                }
                if (bcReference.id === 6) {
                    var callExtObject = this.extractUniVerseFileName(lineDetail);
                    const referenceFileMaster = await appService.fileMaster.getItem({
                        fileNameWithoutExt: callExtObject
                    });
                    lineDetail.referenceFileId = !referenceFileMaster ? null : referenceFileMaster._id;
                }
                const statementReferenceMaster: StatementMaster = this.prepareStatementReferenceMaster(lineDetail, baseCommandMaster, fileMaster);
                lstBaseCommands.push(baseCommandMaster);
                lstStatementReferenceMaster.push(statementReferenceMaster);
                await appService.statementMaster.addItem(statementReferenceMaster);
            }
            // Print file statics... This is only for debugging purpose...
            this.printFileStatics(lstBaseCommands, fileMaster);
            let contentWithoutComments: string[] = [];
            fileLineDetails.forEach(c => contentWithoutComments.push(c.parsedLine));
            let fileStatics: FileStatics = {
                exceptions: null,
                lineCount: fileContentLines.length,
                parsed: true,
                processedLineCount: contentWithoutComments.length
            };
            // Update file status...
            await appService.fileMaster.findByIdAndUpdate(fileMaster._id, {
                processed: true,
                fileStatics: fileStatics
            });
            resolve({ fileMaster });

            // Insert data into file content master table...
            // This part is now added to separate step...            
            const fileContentMaster: FileContentMaster = {
                fid: fileMaster._id,
                formatted: contentWithoutComments.join("\n"),
                original: fileContent,
            } as FileContentMaster;
            await appService.fileContentMaster.addItem(fileContentMaster as FileContentMaster);

        } catch (error) {
            reject({ error });
        } finally { }
    });
    processFileContents = (fileMaster: FileMaster): Promise<any> => new Promise(async (resolve: Function, reject: Function) => {
        try {
            if (!fs.existsSync(fileMaster.filePath)) resolve();
            const fileContent: string = fs.readFileSync(fileMaster.filePath).toString();
            let parsedComments = await appService.statementMaster.getModel().find({
                fileId: fileMaster._id,
            }, "modifiedLine").exec();
            let contentWithoutComments: string[] = [];
            parsedComments.forEach((s) => { contentWithoutComments.push(s.modifiedLine) });
            const fileContentMaster: FileContentMaster = {
                fid: fileMaster._id,
                formatted: contentWithoutComments.join("\n"),
                original: fileContent                
            } as FileContentMaster ;
            await appService.fileContentMaster.addItem(fileContentMaster);
            resolve({ fileMaster });
        } catch (error) {
            reject({ error });
        } finally { }
    });
}

const statementReferenceMasterHelper: StatementReferenceMasterHelper = new StatementReferenceMasterHelper();

export { statementReferenceMasterHelper };