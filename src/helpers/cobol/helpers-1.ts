import { FileMaster, StatementMaster, MissingObjects, ProjectMaster, DataDependency, EntityMaster, EntityAttributes } from "../../models";
import { basename, extname } from "path";
import { readFileSync } from "fs";
import { isEmpty } from "lodash";
import { CobolHelpers } from "yogeshs-utilities";
import { appService } from "../../services/app-service";
import CobolAdditionalHelperTwo from "./helpers-2";
import { CobolVariables } from "src/models/cobol-models";

export default class CobolAdditionalHelperOne extends CobolAdditionalHelperTwo {
    insertWorkingStorageSection = async function insertWorkingStorageSection(tempBlock: StatementMaster[], fileMaster: FileMaster): Promise<void> {
        try {
            const cv: CobolVariables[] = [];
            let sectionId = 0;
            let sectionName: string = '';
            for (let i = 0; i < tempBlock.length; i++) {
                const line = tempBlock[i];
                let currentLine = line.modifiedLine.trimStart();
                const level: string = this.splitLevel(currentLine);
                if (!level) continue;
                currentLine = this.substring(level.length);
                const statement: string = this.splitStatement(currentLine);
                const variable: string = this.splitVariableName(currentLine);

                let length: string = '';
                const dataTypeField: string = this.splitDataTypeField(currentLine);
                let dataType: string = '';
                if (dataTypeField) {
                    length = this.splitLength(dataTypeField).replace("(", "").replace(")", "");
                    dataType = this.splitDataType(dataTypeField);
                }
                if (level === "01") {
                    sectionId++;
                    sectionName = variable.replace(/\s+|\.$/ig, "");
                }
                let defaultValue: string = this.splitDefaultValue(currentLine);
                defaultValue = defaultValue.replace(".", "").trim().replace(/\s+/g, " ");
                const pictureClause: string = this.splitPictureClause(currentLine);
                const computationBinary: string = this.splitComputationBinary(currentLine);
                let cobolVariable = {
                    sectionId: sectionId,
                    sectionName: sectionName,
                    variableName: variable ? variable.replace(".", "").replace(/\s+|\./ig, "") : null,
                    variableLevel: level,
                    dataTypeField: dataTypeField || null,
                    defaultValue: defaultValue || null,
                    fid: fileMaster._id,
                    pid: fileMaster.pid,
                    pictureClause: pictureClause || null,
                    computationOrBinary: computationBinary || null,
                    length: length || null,
                    dataType: dataType || null,
                    statement: statement.trim()
                } as CobolVariables;
                let cvOne = await appService.cobolVariables.addItem(cobolVariable);
                cv.push(cvOne);
            }
        } catch (exception) {
            console.log(exception.InnerException);
        }
    }
    getLinkageSection = function getLinkageSection(allLines: StatementMaster[], cobolSections: string[]): StatementMaster[] {
        const mainMethodBlock: StatementMaster[] = [];
        const linkagePattern = /(.*LINKAGE SECTION.*)/;
        const pdPattern = /(.*PROCEDURE DIVISION.*)/;
        const regexLines = cobolSections.map((section) => new RegExp(`(.*${section}.*)`));
        let indexPosition = -1;
        for (const line of allLines) {
            indexPosition++;
            const lineText = line.modifiedLine;
            if (!linkagePattern.test(lineText)) continue;
            let exist = false;
            for (let i = indexPosition; i < allLines.length; i++) {
                const currentLine = allLines[i].modifiedLine;
                if (currentLine.startsWith("*")) continue;
                if (pdPattern.test(currentLine)) break;
                if (linkagePattern.test(currentLine)) {
                    mainMethodBlock.push(allLines[i]); continue;
                }
                if (regexLines.some(regexLine => regexLine.test(currentLine))) {
                    exist = true;
                }
                if (exist) break;
                mainMethodBlock.push(allLines[i]);
            }
        }
        return mainMethodBlock;
    }
    combineAllLinesInSection = function combineAllLinesInSection(allLines: StatementMaster[]): StatementMaster[] {
        if (allLines.length === 0) return allLines;
        const mainMethodBlock: StatementMaster[] = [];
        let tempString = ''; let tempIndex = 0;
        for (const line of allLines) {
            const currentLine = line.modifiedLine.trimEnd();
            if (currentLine.endsWith('.')) {
                if (!isEmpty(tempString)) {
                    tempString += currentLine;
                    mainMethodBlock.push({
                        lineIndex: tempIndex,
                        originalLine: allLines[tempIndex].originalLine,
                        modifiedLine: tempString,
                        alternateName: allLines[tempIndex].alternateName,
                        indicators: allLines[tempIndex].indicators
                    } as StatementMaster);
                    tempString = '';
                    continue;
                }
                mainMethodBlock.push(line);
                continue;
            }
            if (!tempString) {
                tempIndex = line.lineIndex;
            }
            tempString += tempString ? ' ' + currentLine : currentLine;
        }
        return mainMethodBlock;
    }
    getWorkingStorageSection = function getWorkingStorageSection(allLines: StatementMaster[], cobolSection: string[]): StatementMaster[] {
        const mainMethodBlock: StatementMaster[] = [];
        let indexPosition = -1;
        for (const line of allLines) {
            indexPosition++;
            const regexPattern = /(.*WORKING-STORAGE SECTION.*)/i;
            if (!regexPattern.test(line.modifiedLine)) continue;
            let exist = false;
            for (let i = indexPosition; i < allLines.length; i++) {
                const currentLine = allLines[i].modifiedLine;
                if (currentLine.startsWith("*")) continue;

                const procedureDivisionPattern = /(.*PROCEDURE DIVISION.*)/i;
                if (procedureDivisionPattern.test(currentLine)) break;

                const matchesAnySection = cobolSection.some(section => {
                    const sectionPattern = new RegExp(`(.*${section}.*)`, 'i');
                    return sectionPattern.test(currentLine) && !regexPattern.test(currentLine);
                });

                if (matchesAnySection) {
                    exist = true;
                }

                if (exist) break;
                mainMethodBlock.push({ ...line, modifiedLine: currentLine } as StatementMaster);
            }
        }

        return mainMethodBlock;
    }
    getStatementBetweenSection = function getStatementBetweenSection(allLines: StatementMaster[], cobolSections: string[], sectionName: string): StatementMaster[] {
        const mainMethodBlock: StatementMaster[] = [];
        let indexPosition = -1;
        for (const line of allLines) {
            indexPosition++;
            const newLine = line.modifiedLine.trim();
            const regexPattern = new RegExp(`(.*${sectionName}*)`, 'i');
            if (!regexPattern.test(newLine)) continue;
            for (let i = indexPosition + 1; i < allLines.length; i++) {
                let currentLine = allLines[i].modifiedLine.trim();
                if (currentLine.startsWith("*")) continue;
                const exist = cobolSections.some((d) => d.startsWith(currentLine));
                if (exist) break;
                mainMethodBlock.push({ ...line, modifiedLine: currentLine } as StatementMaster);
            }
        }

        return mainMethodBlock;
    }
    collectAllMethodsData = function collectAllMethodsData(allLines: StatementMaster[], methodNameList: string[]): Record<string, StatementMaster[]> {
        const dictionary: Record<string, StatementMaster[]> = {};
        for (let cnt = 0; cnt < allLines.length; cnt++) {
            const methodName = allLines[cnt].modifiedLine.trim();
            const methodsLines: StatementMaster[] = [];
            if (methodNameList.every(x => methodName !== x)) continue;
            for (let i = cnt + 1; i < allLines.length; i++) {
                const currentLine = allLines[i];
                const firstChar = currentLine.modifiedLine[1];
                const secondChar = currentLine.modifiedLine[2];
                const thisLine = currentLine.modifiedLine.trim();
                if (thisLine === "") continue;
                if (i === allLines.length - 1) {
                    dictionary[methodName] = methodsLines;
                }

                if (methodNameList.some(x => thisLine === x)) {
                    if (!firstChar.match(/\s/) || !secondChar.match(/\s/)) {
                        if (i === allLines.length - 1) methodsLines.push(currentLine);
                        const key = dictionary[methodName] ? methodName + " defineMethod_" + i : methodName;
                        dictionary[key] = methodsLines;
                        cnt = i - 1;
                        break;
                    }
                }
                methodsLines.push(currentLine);
            }
        }

        return dictionary;
    }
    modifyAllMethodsNameLines = function modifyAllMethodsNameLines(allLines: StatementMaster[], methodNameList: string[]): StatementMaster[] {
        const mainBlockList: StatementMaster[] = [];
        for (const statement of allLines) {
            let currentLine = statement.modifiedLine; // or statement.originalLine if you prefer
            if (methodNameList.some((x) => currentLine === x)) {
                if (!currentLine.includes(".")) {
                    mainBlockList.push({ ...statement, modifiedLine: currentLine } as StatementMaster);
                } else {
                    const arrLine = currentLine.split('.');
                    for (const arr of arrLine) {
                        if (arr.trim() === "") continue;
                        mainBlockList.push({ ...statement, modifiedLine: arr } as StatementMaster);
                    }
                    continue;
                }
            } else {
                mainBlockList.push({ ...statement, modifiedLine: currentLine } as StatementMaster);
            }
        }
        return mainBlockList;
    }
    // Google Gemini output
    getAllMethods = function getAllMethods(allLines: string[]): string[] {
        const allMethods: string[] = [];
        for (const line of allLines) {
            const firstChar = line[1];
            const secondChar = line[2];
            // Skip comment lines and lines starting with non-whitespace characters
            if (firstChar === '*' || secondChar === '*') continue;
            if (!/\s/.test(firstChar)) {
                allMethods.push(line);
                continue;
            }
            // Add lines starting with a single whitespace character
            if (!/\s/.test(secondChar)) {
                allMethods.push(line);
            }
        }
        // Remove duplicates using Set (more efficient)
        let methods = Array.from(new Set(allMethods));
        // Process methods to add "." at the end
        const methodNames: string[] = [];
        for (const method of methods) {
            let methodName = method.endsWith(".") ? method : `${method}.`
            methodNames.push(methodName);
        }
        return methodNames;
    }
    // Google Gemini output
    getAllDataBetweenProcedureDivision = function getAllDataBetweenProcedureDivision(allLines: string[]): string[] {
        const mainMethodBlock: string[] = [];
        let indexPosition = -1;
        for (const line of allLines) {
            indexPosition++;
            if (!/PROCEDURE DIVISION.*/.test(line)) continue;
            // Process lines until the next non-empty line (enhanced handling)
            while (indexPosition < allLines.length) {
                if (typeof allLines[indexPosition] === "undefined") continue;
                mainMethodBlock.push(allLines[indexPosition]);
                indexPosition++;
            }
            break;
        }
        return mainMethodBlock.filter((d) => d !== undefined);
    }
    // previously function name in C# was extractSqlStatement
    processExecSqlStatements = async function processExecSqlStatements(allLines: string[], pm: ProjectMaster, fm: FileMaster): Promise<any> {
        // original from C# code
        // var regInto = new Regex(@"(?is)SELECT(.*?)(?<!\w*"")(?=INTO).*?(?<!\w*"")FROM(?!\w*?"")(.*?)(?=WHERE|ORDER|$)", RegexOptions.IgnoreCase);
        // converted to following (applicable to regSelect, regexUpdate, regexDelete)
        // here are comments provided by chatGPT
        // https://yogeshs.slab.com/posts/regular-expression-differences-in-c-and-java-script-2v6pjv81
        // TODO: when we do actual processing of code from this function, pls verify it with C# processing and output should be matched!
        const regInto = /SELECT\s+(.*?)\s+INTO\s+(.*?)\s+FROM\s+(.*?)(\s+WHERE|\s+ORDER|$)/i;
        const regIntoValues = /INSERT\s+INTO([A-z0-9\s]+)\(([^)]*)\)\s+\bVALUES\b/i;
        const regSelect = /SELECT\s+(.*?)\s+FROM\s+(.*?)(\s+WHERE|\s+ORDER|$)/i;
        const regexUpdate = /UPDATE\s+(.*?)\s+SET\s+(.*?)(\s+WHERE|\s+ORDER|$)/i;
        const regexDelete = /DELETE\s+FROM\s+(.*?)(\s+WHERE|\s+ORDER|$)/i;
        for (const pLine of allLines) {
            if (!/^EXEC SQL/.test(pLine)) continue;
            let inputString = pLine.replace(/\s+/g, " ");
            inputString = inputString.replace("EXEC SQL", " ").replace("END-EXEC.", "");
            let attributes = ""; let entityName = "";
            if (regInto.test(inputString)) {
                attributes = regInto.exec(inputString)![1].trim();
                entityName = regInto.exec(inputString)![2].trim();
            } else if (regSelect.test(inputString)) {
                attributes = regSelect.exec(inputString)![1].trim();
                entityName = regSelect.exec(inputString)![2].trim();
            } else if (regIntoValues.test(inputString)) {
                attributes = regIntoValues.exec(inputString)![2].trim();
                entityName = regIntoValues.exec(inputString)![1].trim();
            } else if (regexUpdate.test(inputString)) {
                const allAttributes = regexUpdate.exec(inputString)![2].trim();
                entityName = regexUpdate.exec(inputString)![1].trim();
                const attributesNames = allAttributes.split(',').map(attr => attr.trim());
                const tempAttributes: string[] = [];
                const splitRegex = /(.*)= :|(.*)=/i;
                for (const attribute of attributesNames) {
                    if (!splitRegex.test(attribute)) continue;
                    let splitValues = splitRegex.exec(attribute)![1] || splitRegex.exec(attribute)![2];
                    if (splitValues) tempAttributes.push(splitValues.trim());
                }
                attributes = tempAttributes.join(", ");
            } else if (regexDelete.test(inputString)) {
                attributes = regexDelete.exec(inputString)![1].trim();
                entityName = regexDelete.exec(inputString)![2].trim();
            }
            if (isEmpty(entityName) || isEmpty(attributes)) continue;
            const sortTableNames = entityName.split(',').map(name => name.trim());
            const sortColumnNames = attributes.split(',').map(name => name.trim());
            for (const tableName of sortTableNames) {
                const tName = tableName.trim();
                if (isEmpty(tName)) continue;
                const entityExist = await appService.entityMaster.getItem({ entityName: tName, fid: fm._id });
                if (entityExist) {
                    const dataDependency = { pid: pm._id, fid: fm._id, entity: entityExist.entityName, attributes: '' } as DataDependency;
                    const existing = await appService.dataDependency.getDocuments({ fid: fm._id, entity: tName, pid: pm._id });
                    if (existing.length <= 0) {
                        await appService.dataDependency.addItem(dataDependency);
                    }
                } else {
                    const entity = { pid: pm._id, entityName: tName, fid: fm._id } as EntityMaster;
                    const entityMaster = await appService.entityMaster.addItem(entity);
                    for (const cName of sortColumnNames) {
                        if (!entityMaster) continue;
                        const entityAttribute = { pid: pm._id, eid: entityMaster._id, attributeName: cName.trim(), dataLength: "", dataType: "", entityName: entityMaster.entityName, storeEntitySet: "" } as EntityAttributes;
                        await appService.entityAttributes.addItem(entityAttribute);
                    }
                    if (entityMaster) {
                        const dataDependencies = { pid: pm._id, fid: fm._id, entity: entityMaster.entityName, attributes: '' } as DataDependency;
                        const existingOne = await appService.dataDependency.getDocuments({ fid: fm._id, entity: tName, pid: pm._id });
                        if (existingOne.length <= 0) {
                            await appService.dataDependency.addItem(dataDependencies);
                        }
                    }
                }
            }
        }

        return { status: "OK" };
    }
    combineAllExecSqlStatements = function combineAllExecSqlStatements(allLines: StatementMaster[]): StatementMaster[] {
        const mainBlockList: StatementMaster[] = [];
        if (allLines.length === 0) return mainBlockList;
        const regexExec = /EXEC\s+SQL|EXEC\s+SQL\s+/i;
        const regexExecs = /EXEC\s+CICS|EXEC\s+CICS\s+/i;
        const regexEnd = /END-EXEC|END-EXEC\s+|END-EXEC\.|END-EXEC\.\s+/i;
        for (let i = 0; i < allLines.length; i++) {
            let tempString = '';
            const currentLine = allLines[i].modifiedLine.trim();
            if (!regexExec.test(currentLine) && !regexExecs.test(currentLine)) {
                mainBlockList.push(allLines[i]);
                continue;
            }
            for (let j = i; j < allLines.length; j++, ++i) {
                const cLine = allLines[j].modifiedLine.trim();
                if (regexEnd.test(cLine)) {
                    tempString += ' ' + cLine.trimStart();
                    mainBlockList.push({
                        lineIndex: allLines[i].lineIndex,
                        originalLine: tempString.trimStart(),
                        modifiedLine: tempString.trimStart(),
                        alternateName: allLines[i].alternateName,
                        indicators: allLines[i].indicators
                    } as StatementMaster);
                    break;
                }
                tempString += ' ' + cLine.trimStart();
            }
        }
        return mainBlockList;
    }
    getDataSetStatements = function getDataSetStatements(controlStatements: string[]) {
        const rexFileControl = new RegExp('^SELECT\\s+(?<select>[0-9A-z][-.\w]*[0-9A-z])\\s*ASSIGN\\s+TO\\s+(?<assign>[0-9A-z][-.\w]*[0-9A-z])', 'i');
        let dataSetStatements = new Map<string, string>();
        controlStatements.forEach(statement => {
            const cStatement = statement.trim();
            const match = rexFileControl.exec(cStatement);
            if (!match) return;
            let selectStatement = match.groups ? match.groups['select'] : '';
            let assignStatement = match.groups ? match.groups['assign'] : '';
            assignStatement = assignStatement.replace("UT-S-", "").replace("UT-I-", "").replace("UT-R-", "").replace("UT-D-", "")
                .replace("UR-S-", "").replace("UR-I-", "").replace("UR-R-", "").replace("UR-R-", "")
                .replace("DA-S-", "").replace("DA-I-", "").replace("DA-R-", "").replace("DA-D-", "");
            console.log(`${selectStatement} --#####-- ${assignStatement}`);
            dataSetStatements.set(selectStatement, assignStatement);
        });
        return dataSetStatements;
    }
    combineAllLinesOfWorkingStorageSection = function combineAllLinesOfWorkingStorageSection(allLines: string[]): string[] {
        if (allLines.length === 0) return allLines;
        const mainMethodBlock: string[] = [];
        let tempString = '';
        allLines.forEach(line => {
            const currentLine = line.trimEnd();
            if (currentLine.endsWith('.')) {
                if (tempString !== '') {
                    tempString += currentLine;
                    mainMethodBlock.push(tempString);
                    tempString = '';
                } else {
                    mainMethodBlock.push(currentLine);
                }
                return;
            }
            tempString += currentLine;
        });
        return mainMethodBlock;
    }
    getAnyGenericSection = function getAnyGenericSection(allLines: Array<StatementMaster>, sections: Array<string>, sectionName: string = "FILE SECTION."): Array<StatementMaster> {
        const sectionBlock: Array<StatementMaster> = [];
        const remSec = sections.filter(d => d !== sectionName).join("|");
        const regexPattern = new RegExp(`.*${sectionName}.*`, 'i');
        const remSecRegex = new RegExp(remSec, 'i');
        let indexPosition = -1;
        for (const statement of allLines) {
            indexPosition++;
            if (!regexPattern.test(statement.modifiedLine)) continue;
            for (let i = indexPosition; i < allLines.length; i++) {
                const cl = allLines[i];
                if (cl.modifiedLine.startsWith("*")) continue;
                if (remSecRegex.test(cl.modifiedLine)) break;
                sectionBlock.push(cl);
            }
            break;
        }
        return sectionBlock;
    }
    addIncludeFileLines = async function addIncludeFileLines(allLines: Array<StatementMaster>, fileMaster: FileMaster, includeFiles: Array<FileMaster>, missingObjects: Array<MissingObjects>): Promise<Array<StatementMaster>> {
        const incRegex = new RegExp(/([\+]+)?COPY\s(\w+)|([\+]+)?INCLUDE\s(\w+)/i);
        const regex = new RegExp(/^REPLACING\s+/);
        const regexKeyword = new RegExp(/(?<keyword>^==[A-Za-z0-9-]+==$|^(?!BY\b|IN\b)[A-Za-z0-9-]+$)/i);
        const list: Array<StatementMaster> = [];
        for (let cnt = 0; cnt < allLines.length; cnt++) {
            const line = allLines[cnt].modifiedLine;
            if (!incRegex.test(line)) {
                list.push(allLines[cnt]);
                continue;
            }
            const match = line.match(incRegex);
            const name = match[2] || '';
            if (isEmpty(name)) continue;
            // const incFile = includeFiles.find((d) => name === basename(d.filePath, extname(d.filePath)));
            const incFile = includeFiles.find((d) => name === d.fileNameWithoutExt && ["65d987d75d3f4e653fc7c679", "65d9887a5d3f4e653fc7c682"].includes(d.fileTypeId.toString()));
            if (!incFile) {
                list.push(allLines[cnt]);
                const type = line.includes("COPY") ? "COPY" : "INCLUDE";
                const missingObject = {
                    pid: fileMaster.pid,
                    fid: fileMaster._id,
                    fromObject: fileMaster.fileName,
                    statement: line.trim(),
                    type: type,
                    calledObject: name
                } as MissingObjects;
                missingObjects.push(missingObject);
                continue;
            }
            let copyLines = readFileSync(incFile.filePath, 'utf-8').split('\n').map(function (line, index) {
                return { alternateName: '', fid: incFile._id, pid: incFile.pid, lineIndex: ++index, originalLine: line, modifiedLine: line, indicators: [] } as StatementMaster
            });
            if (copyLines.length <= 0) continue;

            const flagOne = allLines.length - 1 === cnt;
            let nextLine = '';
            if (!flagOne) {
                nextLine = allLines[cnt + 1].modifiedLine.trim();
            }
            let keyword = '';
            if (incRegex.test(line)) {
                if (regex.test(nextLine)) {
                    const newLines: Array<StatementMaster> = [];
                    let lineCnt = ++cnt;
                    for (let i = lineCnt; i < allLines.length; i++) {
                        if (!allLines[i].modifiedLine.trim()) continue;
                        const cLine = allLines[i].modifiedLine.trimStart().trimEnd().replace("REPLACING", "").trim();
                        newLines.push({
                            lineIndex: allLines[i].lineIndex,
                            originalLine: allLines[i].originalLine,
                            modifiedLine: cLine,
                            alternateName: allLines[i].alternateName,
                            indicators: allLines[i].indicators
                        } as StatementMaster);
                        if (cLine.endsWith(".")) break;
                    }

                    const result = this.copyInLines(newLines);
                    let flag = false;
                    for (const r of result) {
                        if (flag) {
                            const newValue = r.modifiedLine.replace("==", "").replace("BY", "").trim();
                            const regKeyword = new RegExp(`\\s+${keyword}\\s+|\\s+${keyword}$`, 'i');
                            for (let x = 0; x < copyLines.length; x++) {
                                let cLine = copyLines[x].modifiedLine;
                                if (!regKeyword.test(cLine)) continue;
                                cLine = cLine.replace(new RegExp(keyword, 'g'), newValue);
                                copyLines[x].modifiedLine = cLine;
                            }
                            keyword = '';
                            flag = false;
                            continue;
                        }
                        const finalWord = r.modifiedLine.match(regexKeyword)?.groups?.keyword || '';
                        if (finalWord === '') continue;
                        flag = true;
                        keyword = finalWord.replace("==", "");
                    }
                    cnt += newLines.length - 1;
                }
            }

            let includeLines = CobolHelpers.prepareSameLength(copyLines as any);
            includeLines = this.removeIncludesCharacter(includeLines, 6, 72);
            const comments = ["*", "/"];
            includeLines = CobolHelpers.removeAllCommentedLines(includeLines as any, comments);
            includeLines = this.removeAll(includeLines, "SKIP", "EJECT");
            list.push(...includeLines as StatementMaster[]);
        }

        return list;
    }
    removeIncludesCharacter = function removeIncludesCharacter(allLines: Array<StatementMaster>, startPosition: number, length: number): Array<StatementMaster> {
        return allLines.map(statement => {
            const line = statement.modifiedLine;
            const newLine = line.substring(startPosition, length).trimEnd();
            return {
                lineIndex: statement.lineIndex,
                originalLine: statement.originalLine,
                modifiedLine: newLine,
                alternateName: statement.alternateName,
                indicators: statement.indicators
            } as StatementMaster;
        });
    }
    concatenateLinesStartingWithIn = function concatenateLinesStartingWithIn(allLines: Array<StatementMaster>): Array<StatementMaster> {
        const newList: Array<StatementMaster> = [];
        let nLine = '';
        for (const statement of allLines) {
            const cLine = statement.modifiedLine.trim();
            if (cLine.startsWith('IN')) {
                nLine += ` ${cLine}`;
            } else {
                if (!isEmpty(nLine)) {
                    const newStatement = { lineIndex: 0, originalLine: nLine.trim(), modifiedLine: nLine.trim(), alternateName: '', indicators: [] } as StatementMaster;
                    newList.push(newStatement);
                    nLine = '';
                }
                newList.push(statement);
            }
        }
        return newList;
    }
    copyInLines = function copyInLines(newLines: Array<StatementMaster>): Array<StatementMaster> {
        const finalLines: Array<StatementMaster> = [];
        if (newLines.length === 0) return newLines;
        const byRegex = new RegExp('^BY\\s+', 'i');
        const inRegex = new RegExp('^IN\\s+', 'i');
        const inLines = this.concatenateLinesStartingWithIn(newLines); // Concatenate multiple IN statements in one line
        for (let i = 0; i < inLines.length; i++) {
            let oLine = inLines[i].modifiedLine.trim();
            if (!oLine) continue;
            if (!byRegex.test(oLine)) { finalLines.push(inLines[i]); continue; }
            const cnt = i + 1;
            if (inLines.length === cnt) {
                finalLines.push(inLines[i]);
                continue;
            }
            for (let j = cnt; j < inLines.length; j++) {
                const inLine = inLines[j].modifiedLine.trim();
                if (inRegex.test(inLine)) {
                    oLine += ` ${inLine}`;
                    const newStatement: StatementMaster = {
                        lineIndex: inLines[i].lineIndex, // Reuse lineIndex from the last statement
                        originalLine: inLines[i].originalLine,
                        modifiedLine: oLine,
                        alternateName: inLines[i].alternateName, // Reuse alternateName from the last statement
                        indicators: inLines[i].indicators // Reuse indicators from the last statement
                    } as StatementMaster;
                    finalLines.push(newStatement);
                    i = j;
                    break;
                }
                finalLines.push(inLines[i]);
                break;
            }
            continue;
        }
        return finalLines;
    }
}