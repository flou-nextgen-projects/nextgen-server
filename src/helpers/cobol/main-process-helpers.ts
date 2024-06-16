import { CobolConstants } from "../../constants";
import { BaseCommandReference, CobolDataSet, StatementMaster, FileMaster, ExternalCalls } from "../../models";
import StatementMasterBase from "../common/statement-master-base";
import { appService } from "../../services/app-service";

export default class CobolProcessHelpers extends StatementMasterBase {
    constructor() { super(); }
    assignBaseCommandIndicators = function (lineDetails: Array<StatementMaster>, commandRefs: Array<BaseCommandReference>): Array<StatementMaster> {
        // logger.log("line details", lineDetails);
        const crudRegEx = new RegExp(/^SELECT\s+|^UPDATE\s+|^DELETE\s+|^INSERT\s+/i);
        const entityCrudRegEx = new RegExp(/^READ\s+(.*?\s+)|^WRITE\s+(.*)|^REWRITE\s+(.*?\s+)/i);
        for (const lineDetail of lineDetails) {
            let modifiedLine = lineDetail.modifiedLine.trim();
            for (const bc of commandRefs) {
                if (bc.ifBlock.start.some((d) => new RegExp(d).test(modifiedLine))) {
                    lineDetail.indicators.push(7);
                }
                if (bc.ifBlock.end.some((d) => modifiedLine.startsWith(d))) {
                    lineDetail.indicators.push(9);
                }
                if (bc.ifBlock.elseBlock.some((d) => d === modifiedLine)) {
                    lineDetail.indicators.push(8);
                }
                if (bc.loop.start.some((d) => modifiedLine.startsWith(d))) {
                    lineDetail.indicators.push(10);
                }
                if (bc.loop.end.some((d) => modifiedLine.startsWith(d))) {
                    lineDetail.indicators.push(11);
                }
                if (bc.callInternals.some((d) => modifiedLine.startsWith(d))) {
                    lineDetail.indicators.push(15);
                }
                if (crudRegEx.test(modifiedLine) || entityCrudRegEx.test(modifiedLine)) {
                    lineDetail.indicators.push(45);
                }
                if (CobolConstants.callExtRegExProgram.test(modifiedLine) || CobolConstants.callExtRegExScreen.test(modifiedLine) ||
                    CobolConstants.regExCall.test(modifiedLine) || CobolConstants.regExCopy.test(modifiedLine) ||
                    CobolConstants.regExInclude.test(modifiedLine) || CobolConstants.regExIncludeMember.test(modifiedLine) ||
                    CobolConstants.regExInput.test(modifiedLine) || CobolConstants.regExInputPattern.test(modifiedLine) ||
                    CobolConstants.regExPattern.test(modifiedLine) || CobolConstants.regExPgm.test(modifiedLine) ||
                    CobolConstants.regExPgmFile.test(modifiedLine) || CobolConstants.regExProc.test(modifiedLine)) {
                    lineDetail.indicators.push(16);
                }
            }
        }
        return lineDetails;
    }
    processStepsData = async function (stepsData: Array<{ step: string, counter: number, lines: string[] }>, { fileMaster, allFiles }: { fileMaster: FileMaster, allFiles: Array<FileMaster> }): Promise<void> {
        const dspRegex: RegExp = /DISP=([^ ]+)/i;
        for (let index = 0; index < stepsData.length; index++) {
            const element = stepsData[index];
            const oStatement = element.step;
            const values = [...element.lines, oStatement];
            let dataSetId = 0;
            let referenceFileId = undefined;
            const matches = oStatement.match(CobolConstants.regExPgmFile);
            const pgmName = matches?.[2]?.trim() || '';
            const objName = pgmName.trim().toUpperCase().replace(/^&|&$/g, '');
            const programFilePath = allFiles.find((f) => f.fileName.toUpperCase().startsWith(objName) && f.fileTypeId === "65e0bfdfac3abe96d9790fb5");
            if (programFilePath) referenceFileId = programFilePath._id;
            for (const value of values) {
                const statements = value.split("DSN=");
                if (statements.length < 2) continue;
                const leftPart = statements[0].trim();
                const rightPart = statements[1].trim();
                let type = "";
                const dsnParts: string[] = rightPart.split(/,(?![^()]*\))/igm);
                for (const part of dsnParts) {
                    if (!part.includes("DISP")) continue;
                    if (!dspRegex.test(part)) continue;
                    const displayValue: string = dspRegex.exec(part)[1].trim();
                    type = (displayValue === "SHR" || displayValue === "OUT") ? "INPUT" : "OUTPUT";
                    break;
                }
                if (type === "") continue;
                const dsnValue: string = dsnParts[0].trim().split(' ').shift();
                const cobolDataSet: CobolDataSet = {
                    dataSetId: ++dataSetId,
                    fid: fileMaster._id,
                    referenceFileId: referenceFileId,
                    calledObjectName: pgmName.trim(),
                    leftVariable: leftPart.trim(),
                    rightVariable: rightPart.trim(),
                    pid: fileMaster.pid,
                    dsnValue: dsnValue,
                    type
                } as CobolDataSet;

                await appService.cobolDataSets.addItem(cobolDataSet);
            }
        }
    }
    extractBusinessName = function (lineDetails: Array<StatementMaster>): string {
        let businessName = '';
        const idRegex = new RegExp('PROGRAM-ID', 'i');
        for (let i = 2; i < lineDetails.length; i++) {
            const line = lineDetails[i].originalLine.trim();
            if (!line) continue;
            if (idRegex.test(line)) continue;
            if (/\*+$/.test(line)) continue;
            for (let j = i; j < lineDetails.length; j++) {
                const jLine = lineDetails[j].originalLine.trim().replace(/^\*+\s*|\s*\*+$/g, '');
                businessName += ` ${jLine}`;
                if (!jLine.endsWith('.')) continue;
                break;
            }
            break;
        }
        return businessName.replace(/\s+/ig, " ");
    }
    removeAll = function (lineDetails: Array<StatementMaster>, ...parameters: string[]): Array<StatementMaster> {
        const regExes = parameters.map((parameter) => new RegExp(`^${parameter}(.*)`, 'igm'));
        let details = lineDetails.filter((line) => !regExes.some((regex) => regex.test(line.modifiedLine.trim())));
        let filtered = details.filter((d) => !parameters.some((p) => d.modifiedLine.trim().startsWith(p)));
        return filtered;
    }
    removeDot = function (lineList: Array<StatementMaster>): StatementMaster[] {
        lineList.forEach((method) => { method.modifiedLine = method.modifiedLine.trim().replace(/\.$/, ''); });
        return lineList;
    }
    processCopyStatements = async function (fileMaster: FileMaster, copyCallStatement: Array<StatementMaster>, includeFiles: Array<FileMaster>) {
        const copyRegex = new RegExp(/([\+]+)?COPY\s*(?<name>[\w]+)/i);
        for (const callStatement of copyCallStatement) {
            if (!copyRegex.test(callStatement.modifiedLine)) continue;
            const cStatement = callStatement.modifiedLine.match(copyRegex)?.groups?.name || '';
            if (!cStatement) continue;
            const copyFile = includeFiles.find(d => d.fileName.startsWith(cStatement));
            const externalCalls = {
                statement: callStatement.modifiedLine, copyBookFileId: copyFile._id,
                fid: fileMaster._id, methodCalled: cStatement, pid: fileMaster.pid
            } as ExternalCalls;
            await appService.externalCalls.addItem(externalCalls);
        }
    }
    doPseudoCodeConversion(lineDetails: Array<StatementMaster>): Array<StatementMaster> {
        for (const lineDetail of lineDetails) {
            let alternateName = this.performPseudoConversion(lineDetail.modifiedLine);
            if (lineDetail.indicators.includes(7)) {
                alternateName = lineDetail.modifiedLine.replace(/^if\s|^If\s|^IF\s/i, "Check if ");
            }
            if (lineDetail.indicators.includes(15)) {
                alternateName = lineDetail.modifiedLine.replace(/^PERFORM\s/i, "Prepare To Execute ");
            }
            alternateName = alternateName ? this.camelCase(alternateName) : this.camelCase(lineDetail.modifiedLine);
            lineDetail.annotatedLine = lineDetail.alternateName = alternateName;
        }
        return lineDetails;
    }
    camelCase(line: string): string {
        return line.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    private performPseudoConversion(currentLine: string) {
        if (currentLine.startsWith("ADD ")) return currentLine.pseudoCodeForAddStatement(currentLine);
        if (currentLine.startsWith("MOVE ")) return currentLine.pseudoCodeForMoveStatement(currentLine);
        if (currentLine.startsWith("FETCH ")) return currentLine.pseudoCodeForFetchStatement(currentLine);
        if (!currentLine.startsWith("COMPUTE ")) return "";
        return currentLine.pseudoCodeForComputeStatement(currentLine);
    }
}