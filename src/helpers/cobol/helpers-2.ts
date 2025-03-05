import { StatementMaster } from "../../models";
import { isNull, isEmpty } from "lodash";

export default class CobolAdditionalHelperTwo {
    // this class is for all small extension methods which are written in C#
    splitLevel = function splitLevel(line: string): string {
        const regexPatternLevel = /^([0-9]{2})/;
        const match = line.match(regexPatternLevel);
        return match ? match[1] : '';
    };
    splitStatement = function splitStatement(line: string): string {
        const typePattern = /(.*)PIC\s[A-z0-9\-()]+/;
        const match = line.match(typePattern);
        return match ? match[1] : '';
    };
    splitVariableName = function splitVariableName(line: string): string {
        const cl = line.trimStart();
        const rpv = new RegExp(/^(?<matchOne>FILLER REDEFINES[\s\w\-\.]+)|^(?<matchTwo>[^\s]*)/, 'i');
        let vn = '';
        const match = rpv.exec(cl);
        if (!match || (!match.groups?.matchOne && !match.groups?.matchTwo)) return vn;

        if (match.groups.matchOne) {
            return match.groups.matchOne.replace("FILLER REDEFINES ", "FILLER_REDEFINES_");
        }

        if (match.groups.matchTwo) {
            return match.groups.matchTwo;
        }

        return vn;
    }
    splitDataTypeField = function splitDataTypeField(line: string): string {
        const currentLine = line;
        let strDataType = '';
        const typePattern = /PIC\s([A-z0-9\-()]+)/;
        if (!typePattern.test(currentLine)) return strDataType;
        const match = currentLine.match(typePattern);
        return match ? match[1] : strDataType;
    }
    splitLength = function splitLength(line: string): string {
        const currentLine = line;
        let length = '';
        const lengthPattern = /(\(\d+\))/;
        if (!lengthPattern.test(currentLine)) return length;
        const matchLength = currentLine.match(lengthPattern);
        return matchLength ? matchLength[1] : length;
    }
    splitDataType = function splitDataType(line: string): string {
        const currentLine = line;
        let dataType = '';
        const lengthPattern = /(^[^(]+|(?<=\().+?(?=\))|[^)]+$)/;
        if (!lengthPattern.test(currentLine)) return dataType;
        const matchLength = currentLine.match(lengthPattern);
        return matchLength ? matchLength[1] : dataType;
    }
    splitDefaultValue = function splitDefaultValue(line: string): string {
        const currentLine = line;
        let defaultValue = '';
        const defaultValues = /(VALUES(.*))/;
        const defaultValuePattern = /(VALUE(.*))/;
        if (defaultValues.test(currentLine)) {
            const match = currentLine.match(defaultValues);
            return match ? match[2] : defaultValue;
        }
        if (!defaultValuePattern.test(currentLine)) return defaultValue;
        const ma = currentLine.match(defaultValuePattern);
        return ma ? ma[2] : defaultValue;
    }
    splitPictureClause = function splitPictureClause(line: string): string {
        const currentLine = line;
        let computationOrBinary = '';
        const pictureClausePattern = /(COMP\s+PIC)/;
        const computationPattern = /(PIC)/;
        if (pictureClausePattern.test(currentLine)) {
            const match = currentLine.match(pictureClausePattern);
            return match ? match[0] : computationOrBinary;
        }
        if (!computationPattern.test(currentLine)) return computationOrBinary;
        const ma = currentLine.match(computationPattern);
        return ma ? ma[0] : computationOrBinary;
    }
    splitComputationBinary = function splitComputationBinary(line: string): string {
        const currentLine = line;
        let computationOrBinary = '';
        const computationOrBinaryPattern = /(comp\-[0-9\s])/i;
        if (!computationOrBinaryPattern.test(currentLine)) return computationOrBinary;
        const match = currentLine.match(computationOrBinaryPattern);
        return match ? match[0] : computationOrBinary;
    }
    splitGoToStatement = function splitGoToStatement(allLines: StatementMaster[]): StatementMaster[] {
        const lineDetails: StatementMaster[] = [];
        if (allLines.length <= 0) return allLines;
        const regex = new RegExp(/(?<statement>.*)((?<goto>GO\s+TO.*))/i);
        for (const line of allLines) {
            if (isEmpty(line.modifiedLine.trim())) continue;
            if (regex.test(line.modifiedLine.trim())) {
                const statement = line.modifiedLine.trim().match(regex)?.groups?.["statement"] || '';
                const goToStatement = line.modifiedLine.trim().match(regex)?.groups?.["goto"] || '';
                if (!isEmpty(statement)) { lineDetails.push(line); }
                if (!isEmpty(goToStatement)) { lineDetails.push({ ...line, modifiedLine: goToStatement } as StatementMaster); }
            } else {
                lineDetails.push(line);
            }
        }
        return lineDetails;
    }
    replaceStatement = function replaceStatement(allLines: StatementMaster[], replaceWith: string, replaceTo: string): StatementMaster[] {
        return allLines.map(line => {
            let modifiedLine = line.modifiedLine;
            if (modifiedLine.startsWith(replaceWith)) {
                let mdLine = modifiedLine.replace(replaceWith, replaceTo);
                return { ...line, modifiedLine: mdLine } as StatementMaster;
            }
            return line;
        });
    }
    combineLineForMoveToStatement = function combineLineForMoveToStatement(allLines: StatementMaster[], cobolKeyWords: string[]): StatementMaster[] {
        if (allLines.length <= 0) return [];
        const mainMethodBlock: StatementMaster[] = [];
        let moveLineStatement: string = '';
        const regex = /(['"])(((?:\\\1)|(?!\1).+))\1/;
        const regexTo = /\s+TO\s+/i;
        for (const statement of allLines) {
            const line = statement.modifiedLine;
            if (cobolKeyWords.some(x => line.startsWith(x)) && !line.startsWith("MOVE ")) {
                mainMethodBlock.push(statement);
                moveLineStatement = '';
                continue;
            }
            if (line.startsWith("MOVE ")) {
                moveLineStatement = '';
                const match = line.match(regex);
                const value = match ? match[0] : '';
                if (regexTo.test(line) && !value.includes(" TO ")) {
                    mainMethodBlock.push(statement);
                    continue;
                }
                if (line.endsWith("TO ") || !line.includes(" TO ") || value.includes(" TO ")) {
                    moveLineStatement = line;
                    continue;
                }
                mainMethodBlock.push(statement);
                continue;
            }
            if (moveLineStatement !== '') {
                if (cobolKeyWords.some(x => line.startsWith(x)) || line === ".") {
                    mainMethodBlock.push(statement);
                    moveLineStatement = '';
                } else {
                    if (line.startsWith("EXEC SQL ") && line.endsWith("END-EXEC")) {
                        mainMethodBlock.push(statement);
                    } else {
                        const nl = moveLineStatement + " " + line;
                        mainMethodBlock.push({ ...statement, modifiedLine: nl } as StatementMaster);
                    }
                }
            } else {
                mainMethodBlock.push(statement);
                moveLineStatement = '';
            }
        }
        return mainMethodBlock;
    }
    convertAllMoveStatement = function convertAllMoveStatement(allLines: StatementMaster[], cobolKeyWords: string[]): StatementMaster[] {
        if (allLines.length <= 0) return [];
        const mainMethodBlock: StatementMaster[] = [];
        let moveLineStatement: string = '';
        for (const statement of allLines) {
            const line = statement.modifiedLine;
            if (line === ".") {
                mainMethodBlock.push(statement);
                moveLineStatement = '';
                continue;
            }
            if (line.startsWith("MOVE ") && line.includes(" TO ")) {
                const moveStatement = line.split("TO", 2);
                moveLineStatement = moveStatement[0];
                mainMethodBlock.push(statement);
            } else if (moveLineStatement !== '') {
                if (cobolKeyWords.some(x => line.startsWith(x)) || line === ".") {
                    mainMethodBlock.push(statement);
                    moveLineStatement = '';
                } else {
                    const newLine = moveLineStatement + " TO " + line;
                    mainMethodBlock.push({
                        indicators: statement.indicators,
                        originalLine: statement.originalLine,
                        modifiedLine: newLine,
                        alternateName: statement.alternateName,
                        methodName: statement.methodName,
                        location: statement.location
                    } as StatementMaster);
                }
            } else {
                mainMethodBlock.push(statement);
                moveLineStatement = '';
            }
        }
        return mainMethodBlock;
    }
    addEndIfStatement = function addEndIfStatement(allLines: StatementMaster[]): StatementMaster[] {
        const mainMethodBlock: StatementMaster[] = [];
        let ifCounter: number = 0;
        const elseIfRegex = /^ELSE IF(.*)/i;
        for (const statement of allLines) {
            const line = statement.modifiedLine;
            if (line.startsWith("IF ")) {
                ifCounter++;
                mainMethodBlock.push(statement);
            } else if (line === "ELSE") {
                mainMethodBlock.push(statement);
            } else if (line === "END-IF") {
                const cnt = this.countStringOccurrences(line, "END-IF");
                if (cnt !== 1) {
                    for (let i = 0; i < cnt; i++) {
                        mainMethodBlock.push({
                            indicators: statement.indicators,
                            originalLine: statement.originalLine,
                            modifiedLine: "END-IF ",
                            alternateName: statement.alternateName,
                            methodName: statement.methodName,
                            location: statement.location
                        } as StatementMaster);
                        ifCounter--;
                    }
                } else {
                    ifCounter--;
                    mainMethodBlock.push(statement);
                }
            } else if (line === "END-IF.") {
                for (let i = 0; i < ifCounter; i++) {
                    mainMethodBlock.push({
                        indicators: statement.indicators,
                        originalLine: statement.originalLine,
                        modifiedLine: "END-IF ",
                        alternateName: statement.alternateName,
                        methodName: statement.methodName,
                        location: statement.location
                    } as StatementMaster);
                }
                ifCounter = 0;
            } else if (elseIfRegex.test(line)) {
                const ifGroup = line.match(elseIfRegex)![1].trim();
                mainMethodBlock.push({
                    indicators: statement.indicators,
                    originalLine: statement.originalLine,
                    modifiedLine: "ELSE",
                    alternateName: statement.alternateName,
                    methodName: statement.methodName,
                    location: statement.location
                } as StatementMaster);
                const addStatement = {
                    indicators: statement.indicators,
                    originalLine: statement.originalLine,
                    modifiedLine: "IF " + ifGroup,
                    alternateName: statement.alternateName,
                    methodName: statement.methodName,
                    location: statement.location
                } as StatementMaster;
                mainMethodBlock.push(addStatement);
                ifCounter++;
            } else {
                if (ifCounter === 0) {
                    mainMethodBlock.push(statement);
                    continue;
                } else {
                    if (line.endsWith(".")) {
                        mainMethodBlock.push({
                            indicators: statement.indicators,
                            originalLine: statement.originalLine,
                            modifiedLine: line.replace(".", "").trim(),
                            alternateName: statement.alternateName,
                            methodName: statement.methodName,
                            location: statement.location
                        } as StatementMaster);
                        for (let i = 0; i < ifCounter; i++) {
                            mainMethodBlock.push({
                                indicators: statement.indicators,
                                originalLine: statement.originalLine,
                                modifiedLine: "END-IF ",
                                alternateName: statement.alternateName,
                                methodName: statement.methodName,
                                location: statement.location
                            } as StatementMaster);
                        }
                        ifCounter = 0;
                        continue;
                    }
                }
            }
        }
        return mainMethodBlock;
    }
    countStringOccurrences = function countStringOccurrences(str: string, subString: string): number {
        return str.split(subString).length - 1;
    }
    addNewLineForMultipleKeyword = function addNewLineForMultipleKeyword(allLines: StatementMaster[], cobolKeyWords: string[]): StatementMaster[] {
        const mainMethodBlock: StatementMaster[] = [];
        for (const statement of allLines) {
            const line = statement.modifiedLine;
            if (line.startsWith("EXEC CICS") || line.startsWith("EXEC CICS ")) {
                mainMethodBlock.push(statement);
                continue;
            }

            const cnt = line.split(' ').filter(word => cobolKeyWords.includes(word)).length;
            if (cnt <= 1) {
                mainMethodBlock.push(statement);
                continue;
            }

            let firstIndex = line.indexOf("'");
            let lastIndex = line.lastIndexOf("'");
            let newLine = "";
            const lineWords = line.split(' ');
            for (let index = 0; index < lineWords.length; index++) {
                const key = lineWords[index];
                if (key.trim() === "") continue;
                if (cobolKeyWords.includes(key) && line.indexOf(key, 0) < firstIndex && line.indexOf(key, 0) > lastIndex) {
                    if (newLine !== "") {
                        mainMethodBlock.push({
                            indicators: statement.indicators,
                            originalLine: statement.originalLine,
                            modifiedLine: newLine.trim(),
                            alternateName: statement.alternateName,
                            methodName: statement.methodName,
                            location: statement.location
                        } as StatementMaster);
                    }
                    newLine = key;
                } else {
                    newLine += key + " ";
                    if (index === lineWords.length - 1) {
                        mainMethodBlock.push({
                            indicators: statement.indicators,
                            originalLine: statement.originalLine,
                            modifiedLine: newLine.trim(),
                            alternateName: statement.alternateName,
                            methodName: statement.methodName,
                            location: statement.location
                        } as StatementMaster);
                    }
                }
            }
        }
        return mainMethodBlock;
    }
    splitAllLinesAfterDot = function splitAllLinesAfterDot(allLines: StatementMaster[]): StatementMaster[] {
        const mainBlockList: StatementMaster[] = [];
        for (const statement of allLines) {
            const currentLine = statement.modifiedLine.split('.');
            for (const cLine of currentLine) {
                if (cLine.trim() === "") continue;
                mainBlockList.push({
                    indicators: statement.indicators,
                    originalLine: statement.originalLine,
                    modifiedLine: cLine,
                    alternateName: statement.alternateName,
                    methodName: statement.methodName,
                    location: statement.location
                } as StatementMaster);
            }
        }
        return mainBlockList;
    }
    conversionOfEvaluateStatement = function conversionOfEvaluateStatement(allLines: StatementMaster[]): StatementMaster[] {
        const mainBlock: StatementMaster[] = [];
        for (let cnt = 0; cnt < allLines.length; cnt++) {
            const tempBlock: StatementMaster[] = [];
            const currentLine = allLines[cnt].modifiedLine;
            if (!currentLine.startsWith("EVALUATE ")) {
                mainBlock.push(allLines[cnt]);
                continue;
            }

            for (let i = cnt; i < allLines.length; i++) {
                const newLine = allLines[i].modifiedLine;
                if (newLine === "END-EVALUATE") {
                    tempBlock.push(allLines[i]);
                    const evaluateBlock = this.pickUpOnlyEvaluateBlock(tempBlock);
                    mainBlock.push(...evaluateBlock);
                    cnt = i;
                    break;
                }
                tempBlock.push(allLines[i]);
            }
        }
        return mainBlock;
    }
    pickUpOnlyEvaluateBlock = function pickUpOnlyEvaluateBlock(allLines: StatementMaster[]): StatementMaster[] {
        let copyOfBlock: StatementMaster[] = [...allLines];
        let indexPosition: number = -1;
        let caseCondition: string = '';
        for (let i = 0; i < allLines.length; i++) {
            indexPosition++;
            const line = allLines[i].modifiedLine;
            if (line.startsWith("EVALUATE")) {
                copyOfBlock[indexPosition].modifiedLine = "";
                caseCondition = line.replace("EVALUATE", "").trim();
            }
            if (line === "END-EVALUATE") {
                copyOfBlock[indexPosition].modifiedLine = "END-IF";
            }
        }

        let counter: number = 0;
        allLines = [];
        allLines.push(...copyOfBlock.filter(line => line.modifiedLine !== ""));
        copyOfBlock = [];
        let whenConditions: string[] = [];
        for (const statement of allLines) {
            let currentLine = statement.modifiedLine;
            if (currentLine === "WHEN OTHER") {
                let caseOther = whenConditions.reduce((current: string, condition: string) => current + condition + " == " + caseCondition + " OR ", "");
                if (caseOther === "") caseOther = " OR ";
                caseOther = "IF NOT (" + caseOther.slice(0, caseOther.lastIndexOf("OR")) + ") THEN";
                copyOfBlock.push({ ...statement, modifiedLine: "END-IF" } as StatementMaster);
                copyOfBlock.push({ ...statement, modifiedLine: caseOther } as StatementMaster);
                continue;
            }

            if (currentLine.startsWith("WHEN ") && counter === 0) {
                whenConditions.push(currentLine.replace("WHEN", ""));
                currentLine = currentLine.replace("WHEN ", "IF ") + " == " + caseCondition + " THEN ";
                copyOfBlock.push({ ...statement, modifiedLine: currentLine } as StatementMaster);
                counter++;
                continue;
            }

            if (currentLine.startsWith("WHEN ") && counter >= 1) {
                whenConditions.push(currentLine.replace("WHEN", ""));
                copyOfBlock.push({ ...statement, modifiedLine: "END-IF" } as StatementMaster);
                currentLine = currentLine.replace("WHEN ", "IF ") + " == " + caseCondition + " THEN";
                copyOfBlock.push({ ...statement, modifiedLine: currentLine } as StatementMaster);
                counter++;
                continue;
            }

            copyOfBlock.push(statement);
        }

        return copyOfBlock;
    }
    conversionOfCrudActivities = function conversionOfCrudActivities(allLines: StatementMaster[]): StatementMaster[] {
        const mainBlock: StatementMaster[] = [];
        if (allLines.length <= 0) return mainBlock;
        for (const statement of allLines) {
            const regexSqlSelect = /EXEC SQL(\s+[A-z0-9\-]+\s+)/;
            const ciCsStatement = /EXEC CICS(\s+[A-z0-9\-]+\s+)/;
            const currentLine = statement.modifiedLine.trim();
            if (regexSqlSelect.test(statement.modifiedLine)) {
                const matches = currentLine.match(regexSqlSelect);
                const pgmName = matches[1].trim();
                if (pgmName === "SELECT" || pgmName === "UPDATE") {
                    const newLine = currentLine.replace("EXEC SQL ", "").replace("EXEC SQL", "").replace("END-EXEC. ", "").replace("END-EXEC.", "").replace("END-EXEC", "").replace("END-EXEC ", "").trim();
                    mainBlock.push({ ...statement, modifiedLine: newLine } as StatementMaster);
                    continue;
                }
            }

            if (ciCsStatement.test(currentLine)) {
                const matches = currentLine.match(ciCsStatement);
                const actionStatement = matches[1].trim();
                if (actionStatement === "READ") {
                    const newReadLine = this.readStatementConversion(statement);
                    mainBlock.push({ ...statement, modifiedLine: newReadLine } as StatementMaster);
                    continue;
                }

                if (actionStatement === "SEND") {
                    const newSendLine = this.sendStatementConversion(statement);
                    mainBlock.push({ ...statement, modifiedLine: newSendLine } as StatementMaster);
                    continue;
                }

                if (actionStatement === "RECEIVE") {
                    const newReceiveLine = this.receiveStatementConversion(statement);
                    mainBlock.push({ ...statement, modifiedLine: newReceiveLine } as StatementMaster);
                    continue;
                }

                if (actionStatement === "HANDLE") {
                    const newList = this.handleStatementConversion(statement);
                    mainBlock.push(...newList);
                    continue;
                }

                if (actionStatement === "XCTL" || actionStatement === "LINK") {
                    const newProgramLine = this.programStatementConversion(statement);
                    mainBlock.push({ ...statement, modifiedLine: newProgramLine } as StatementMaster);
                    continue;
                }

                const cLine = currentLine.replace("EXEC CICS", "").replace("EXEC CICS ", "").replace("END-EXEC.", "").replace("END-EXEC", "").replace("END-EXEC ", "");
                mainBlock.push({ ...statement, modifiedLine: cLine } as StatementMaster);
                continue;
            }

            mainBlock.push(statement);
        }
        return mainBlock;
    }
    readStatementConversion = function readStatementConversion(statement: string): string {
        let nLine = "READ FROM ";
        const toStr = "EXEC CICS READ";
        const mapStatement = statement.split(toStr);
        let intoState = "";
        let fieldState = "";
        let dataSet = "";
        if (mapStatement.length > 1) {
            const mapState = mapStatement[1].split(')');
            const finalMapStatement = mapState;
            for (const mStatement of finalMapStatement) {
                const cLine = mStatement.trim();
                if (cLine === "END-EXEC." || cLine === "END-EXEC") continue;
                if (cLine.startsWith("DATASET"))
                    dataSet = cLine.replace("(", " ").replace(")", " ").replace("'", "").trim();
                if (cLine.startsWith("RIDFLD")) {
                    const toStrField = "RIDFLD";
                    const fieldStatement = cLine.split(toStrField);
                    fieldState = fieldStatement[1].replace("(", "").replace(")", "").replace("'", "").trim();
                }
                if (cLine.startsWith("INTO")) {
                    const intoStatement = cLine.split(' ');
                    for (const iStatement of intoStatement) {
                        if (iStatement.trim() === "") continue;
                        intoState += iStatement.replace("(", " ").replace(")", " ").replace("'", "").trim() + " ";
                    }
                }
            }
        }
        nLine += dataSet + " " + intoState + "USING KEY " + fieldState;
        return nLine;
    }
    sendStatementConversion = function sendStatementConversion(currentStatement: string): string {
        let nLine = "SEND TO USER SCREEN ";
        const toStr = "MAP(";
        const mapStatement = currentStatement.split(toStr);
        let mapState = "";
        if (mapStatement.length > 1) mapState = mapStatement[1];
        const finalMapStatement = mapState.split(' ');
        let index = 0;
        for (const mStatement of finalMapStatement) {
            index++;
            if (mStatement === "END-EXEC." || mStatement === "END-EXEC") continue;
            if (index === 1) {
                nLine += mStatement.replace("(", "").replace(")", "").trim();
                nLine += " USING MAP DATASET ";
            } else {
                if (!mStatement.startsWith("MAPSET(") && !mStatement.startsWith("FROM(")) continue;
                if (mStatement.startsWith("MAPSET(")) {
                    const mapSetStatement = mStatement.split("MAPSET(");
                    if (mapSetStatement.length <= 1) { return nLine; }
                    nLine += mapSetStatement[1].replace("(", "").replace(")", "").trim();
                }
                if (!mStatement.startsWith("FROM(")) {
                    continue;
                } else {
                    const mapSetStatement = mStatement.split("FROM(");
                    if (mapSetStatement.length <= 1) { return nLine; }
                    nLine += " FROM ";
                    nLine += mapSetStatement[1].replace("(", "").replace(")", "").trim();
                }
            }
        }
        return nLine;
    }
    receiveStatementConversion = function receiveStatementConversion(currentStatement: string): string {
        let nLine = "RECEIVE USER SCREEN ";
        const toStr = "MAP(";
        let mapState = "";
        const mapStatement = currentStatement.split(toStr);
        if (mapStatement.length > 1) mapState = mapStatement[1];
        const finalMapStatement = mapState.split(' ');
        let index = 0;
        for (const mStatement of finalMapStatement) {
            index++;
            if (mStatement === "END-EXEC." || mStatement === "END-EXEC") continue;
            if (index === 1) {
                nLine += mStatement.replace("(", "").replace(")", "").trim();
                nLine += " USING MAP DATASET ";
            } else {
                if (!mStatement.startsWith("MAPSET(") && !mStatement.startsWith("INTO(")) continue;
                if (mStatement.startsWith("MAPSET(")) {
                    const mapSetStatement = mStatement.split("MAPSET(");
                    nLine += mapSetStatement[1].replace("(", "").replace(")", "").trim();
                }
                if (!mStatement.startsWith("INTO(")) {
                    continue;
                } else {
                    nLine += " INTO ";
                    const mapSetStatement = mStatement.split("INTO(");
                    nLine += mapSetStatement[1].replace("(", " ").replace(")", " ").trim();
                }
            }
        }
        return nLine;
    }
    handleStatementConversion = function handleStatementConversion(currentStatement: string): string[] {
        const mainBlock: string[] = [];
        const regEx = /\((?<method>.*)\)/i;
        if (currentStatement.startsWith("EXEC CICS HANDLE AID")) {
            const toStr = "AID";
            const moveStatement = currentStatement.split(toStr);
            if (moveStatement.length > 1) {
                const moveState = moveStatement[1];
                const finalStatement = moveState.split(' ');
                for (const statement of finalStatement) {
                    if (statement === "END-EXEC." || statement === "END-EXEC") continue;
                    if (!statement.trim()) continue;
                    const state = statement.split('(');
                    if (!state[0] || state[0] === "\'") continue;
                    const pVal = regEx.exec(statement)?.groups?.method || '';
                    const mainLine = `IF ${state[0]}(${pVal}) IS PRESSED`;
                    mainBlock.push(mainLine);
                    if (state.length > 1) {
                        const internalCall = `PERFORM ${state[1].replace("(", "").replace(")", "")}`;
                        mainBlock.push(internalCall);
                    }
                    mainBlock.push("END-IF");
                }
            }
        } else if (currentStatement.startsWith("EXEC CICS HANDLE CONDITION")) {
            const toStr = "CONDITION";
            const moveStatement = currentStatement.split(toStr);
            if (moveStatement.length > 1) {
                const moveState = moveStatement[1].trim();
                const finalStatement = moveState.split(')');
                const finalStatCount = finalStatement.length - 1;
                let index = 0;
                for (const statement of finalStatement) {
                    const newStatement = statement.trim();
                    index++;
                    if (newStatement === "END-EXEC." || newStatement === "END-EXEC") continue;
                    if (!newStatement.trim()) continue;
                    const ifState = index === 1 ? "IF " : "ELSE-IF ";
                    let ifLine = `${ifState}CONDITION IS ${newStatement.split('(')[0]}`;
                    if (finalStatCount > 1 && index === finalStatCount) ifLine = "ELSE ";
                    mainBlock.push(ifLine);
                    if (newStatement.includes('(')) {
                        const internalCall = `PERFORM ${newStatement.split('(')[1].replace("(", "").replace(")", "")}`;
                        mainBlock.push(internalCall.trim());
                    }
                }
                mainBlock.push("END-IF");
            }
        }
        return mainBlock;
    }
    programStatementConversion = function programStatementConversion(currentStatement: string): string {
        let nLine = "CALL ";
        const mapStatement = currentStatement.split(/PROGRAM\(|PROGRAM \(/ig, 2);
        const mapState = mapStatement[1];
        const finalMapStatement = mapState.split(' ');
        let index = 0;
        for (const mStatement of finalMapStatement) {
            index++;
            if (mStatement === "END-EXEC." || mStatement === "END-EXEC") continue;
            if (index === 1) {
                nLine += mStatement.replace("(", "").replace(")", "").trim();
                nLine += " PASSING ";
            } else {
                if (!mStatement.startsWith("COMMAREA(")) continue;
                const tostr = "COMMAREA(";
                const mapSetStatement = mStatement.split(tostr);
                nLine += mapSetStatement[1].replace("(", "").replace(")", "").trim();
            }
        }
        return nLine;
    }
    removeExecStatement = function removeExecStatement(allLines: StatementMaster[]): StatementMaster[] {
        allLines.forEach((x) => x.modifiedLine.trimStart());
        const mainBlock: StatementMaster[] = [];
        for (const line of allLines) {
            let nLine = line.modifiedLine.replace("EXEC SQL", " ").replace("END-EXEC", " ");
            const regex = new RegExp("[\\s]{2,}", "g");
            const modifiedLine = nLine.replace(regex, " ");
            mainBlock.push({ ...line, modifiedLine } as StatementMaster);
        }
        return mainBlock;
    }
    combineAllNonKeywordLines = function combineAllNonKeywordLines(allLines: StatementMaster[], cobolKeyWords: string[]): StatementMaster[] {
        const newLines: StatementMaster[] = [];
        if (allLines.length === 0) return allLines;
        for (const statement of allLines) {
            if (!statement.originalLine) continue;
            let cLine = statement.originalLine.trim();
            const result = cobolKeyWords.some(d => cLine.startsWith(d));
            if (result) {
                newLines.push(statement);
            } else {
                const lastItem = newLines[newLines.length - 1];
                lastItem.modifiedLine += isNull(lastItem.modifiedLine) || isEmpty(lastItem.modifiedLine) ? cLine : " " + cLine;
                newLines[newLines.length - 1] = lastItem;
            }
        }
        return newLines;
    }
}