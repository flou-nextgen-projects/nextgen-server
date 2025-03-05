import { LineDetails, TreeView } from "../../models";
export default class UniverseArrayExtensions extends Array {
    public _globalId: number;
    constructor() {
        super(); this._globalId = 1;
    }
    removeCommentedAndBlankLines = function (inputArray: string[], commentChar: string): LineDetails[] {
        var lines = inputArray || [];
        var lineDetails = Array<LineDetails>();
        lines.forEach((line, index) => {
            const ld: LineDetails = {
                parsedLine: line.trim(),
                originalLine: line,
                location: index
            };
            lineDetails.push(ld);
        });

        const inputLines = lineDetails.filter(function (line) {
            return !((typeof line.parsedLine === "undefined"
                || line.parsedLine === ""
                || line.parsedLine === null
                || /\\s+/.test(line.parsedLine)))
                && !line.parsedLine.startsWith(commentChar);
        });
        return inputLines;
    };
    combineAllBrokenLines = function (inputArray: LineDetails[], lineBreakElement: string = "_", keepOrRemove: boolean = true): LineDetails[] {
        if (inputArray && inputArray.length <= 0) return inputArray;
        var tempList: LineDetails[] = [];
        var indexPosition = -1;
        var tempString = "";
        var regex = new RegExp("[" + lineBreakElement + "\\s]$", "ig");
        for (var i = 0; i < inputArray.length; i++) {
            indexPosition++;
            const lineDetails = inputArray[i];
            const strInput = inputArray[i].parsedLine.trimEnd();
            if (regex.test(strInput)) {
                if (strInput.trim().startsWith("'")) continue;
                for (let index = 0; index < inputArray.length; index++) {
                    const element = inputArray[index].parsedLine.trimEnd();
                    if (regex.test(element)) {
                        if (keepOrRemove) {
                            tempString += element.slice(element.length - 1, 1).trim() + " ";
                        }
                        else {
                            tempString += element.trim() + " ";
                        }
                        indexPosition++;
                        continue;
                    }

                    tempString += element.trim();
                    lineDetails.parsedLine = tempString;
                    tempList.push(lineDetails);
                    tempString = "";
                    break;
                }
                i = indexPosition;
            }
            else {
                tempList.push(lineDetails);
            }
        }
        return tempList;
    };
    ifBlockStatements = function (allSeqListItems: Array<TreeView>, lstTreeView: Array<TreeView>): Array<TreeView> {
        let indexPosition = -1;
        let ifCounter = 0;
        for (var treeItem of allSeqListItems) {
            indexPosition++;
            if (!(treeItem.indicators && treeItem.indicators.includes(1))) continue;

            var treeViewList = new Array<TreeView>();
            for (let i = indexPosition; i < lstTreeView.length; i++) {
                treeViewList.push(lstTreeView[i]);
                const baseCommandMaster = lstTreeView[i].indicators;
                if (baseCommandMaster && baseCommandMaster.includes(1)) ifCounter++;
                if (baseCommandMaster && baseCommandMaster.includes(2)) ifCounter--;
                if (ifCounter === 0) break;
            }
            var prevParentId = treeViewList[0].parentId;
            var graphId = "IfBlockStart-" + indexPosition + treeItem.actualStatementId;
            treeViewList[0].graphId = graphId;
            for (let j = 1; j < treeViewList.length; j++) {
                const baseCommandMaster = treeViewList[j].indicators;
                if (!(treeViewList[j].parentId === prevParentId)) continue;
                treeViewList[j].parentId = graphId;

                treeViewList[j].indentLevel = treeViewList[j].indentLevel + 2;
                if (baseCommandMaster && baseCommandMaster.includes(2))
                    treeViewList[j].indentLevel = treeViewList[0].indentLevel;
            }
        }
        return lstTreeView;
    };
    loopBlockStatements = function (allSeqListItems: Array<TreeView>, lstTreeView: Array<TreeView>): Array<TreeView> {
        let indexPosition = -1;
        let loopCounter = 0;
        for (const treeItem of allSeqListItems) {
            indexPosition++;
            if (!(treeItem.indicators && treeItem.indicators.includes(3))) continue;
            var treeViewList = new Array<TreeView>();
            for (let i = indexPosition; i < lstTreeView.length; i++) {
                treeViewList.push(lstTreeView[i]);
                const baseCommandMaster = lstTreeView[i].indicators;
                if (baseCommandMaster && baseCommandMaster.includes(3)) loopCounter++;
                if (baseCommandMaster && baseCommandMaster.includes(4)) loopCounter--;
                if (loopCounter == 0) break;
            }
            let curIndentLevel = treeViewList.first().indentLevel;
            var prevParentId = treeViewList.first().parentId;
            var graphId = "LoopStart-" + indexPosition + treeItem.actualStatementId;
            treeViewList.first().graphId = graphId;
            treeViewList.first().indentLevel = curIndentLevel + 1;
            for (let j = 1; j < treeViewList.length; j++) {
                if (!(treeViewList[j].parentId === prevParentId)) continue;

                treeViewList[j].parentId = graphId;
                let treeGraphId = treeViewList[j].graphId;
                let childItems = allSeqListItems.filter((value, index) => {
                    return value.parentId === treeGraphId;
                })
                const baseCommandMaster = lstTreeView[j].indicators;
                childItems.forEach(c => { c.indentLevel = c.indentLevel + 2; });
                treeViewList[j].indentLevel = treeViewList[j].indentLevel + 2;
                if (baseCommandMaster && baseCommandMaster.includes(4))
                    treeViewList[j].indentLevel = curIndentLevel + 1;
            }
        }
        return allSeqListItems;
    };
    elseBlockStatements = function (allSeqListItems: Array<TreeView>, lstTreeView: Array<TreeView>): Array<TreeView> {
        let indexPosition = -1;
        for (var treeItem of allSeqListItems) {
            indexPosition++;
            if (!(treeItem.indicators && treeItem.indicators.includes(10))) continue;
            let endIfCounter = -1;
            var treeViewList = new Array<TreeView>();
            for (let i = indexPosition; i < lstTreeView.length; i++) {
                treeViewList.push(lstTreeView[i]);
                const baseCommandMaster = lstTreeView[i].indicators;
                if (baseCommandMaster && baseCommandMaster.includes(1)) endIfCounter--;
                if (baseCommandMaster && baseCommandMaster.includes(2)) endIfCounter++;
                if (endIfCounter === 0) break;
            }
            let curIndentLevel = treeViewList.first().indentLevel;
            var prevParentId = treeViewList.first().parentId;
            var graphId = "ElseBlock-" + indexPosition + treeItem.actualStatementId;
            treeViewList.first().graphId = graphId;
            var parentIf = allSeqListItems.find(f => f.graphId === prevParentId);
            treeViewList.first().indentLevel = parentIf.indentLevel;
            for (var j = 1; j < treeViewList.length; j++) {
                const baseCommandMaster = lstTreeView[j].indicators;
                if (baseCommandMaster && baseCommandMaster.includes(2)) continue;
                if (!(treeViewList[j].parentId === prevParentId)) continue;

                treeViewList[j].parentId = graphId;
                treeViewList[j].indentLevel = curIndentLevel + 1;
            }
        }
        return allSeqListItems;
    };
    processChildItems = function (lstTreeView: Array<TreeView>, currentItem: TreeView): Array<string> {
        let lstDecisions = new Array<string>();
        let carryForward = "T";
        lstDecisions.push(carryForward);
        var allChildItems: Array<TreeView> = lstTreeView.filter((value) => { return value.parentId === currentItem.graphId; });
        for (const childItem of allChildItems) {
            if (childItem.indicators && childItem.indicators.includes(2)) continue;
            if (childItem.indicators && childItem.indicators.includes(1)) {
                this.processTreeChildItems(lstTreeView, childItem, carryForward, false, lstDecisions);
            }
            if ([5, 6, 3, 8].some((d) => childItem.indicators.includes(d))) {
                this.processTreeChildItems(lstTreeView, childItem, carryForward, true, lstDecisions);
            }
            if (!(childItem.indicators && childItem.indicators.includes(10))) continue;
            carryForward = "F";
            this.processTreeChildItems(lstTreeView, childItem, carryForward, false, lstDecisions);
        }
        return lstDecisions;
    };
    processTreeChildItems = function (lstTreeView: Array<TreeView>, currentItem: TreeView, carryForward: string, callIntOrExtOrLoop: boolean, lstDecisions: string[]) {
        var allChildItems: Array<TreeView> = lstTreeView.filter((value) => { return value.parentId === currentItem.graphId; });
        if (!callIntOrExtOrLoop) {
            lstDecisions.push(carryForward);
        }
        for (const childItem of allChildItems) {
            if (childItem.indicators && childItem.indicators.includes(2)) continue;
            if (childItem.indicators && childItem.indicators.includes(1)) {
                this.processTreeChildItems(lstTreeView, childItem, carryForward, false, lstDecisions);
            }
            if ([5, 6, 3, 8].some((d) => childItem.indicators.includes(d))) {
                this.processTreeChildItems(lstTreeView, childItem, carryForward, true, lstDecisions);
            }
            if (!(childItem.indicators && childItem.indicators.includes(10))) continue;
            this.processTreeChildItems(lstTreeView, childItem, carryForward, false, lstDecisions);
        }
    };
    setIndentationLevel = function (lstTreeView: Array<TreeView>): Array<TreeView> {
        let lvlNumber = -1; let iPos = -1;
        for (var treeItem of lstTreeView) {
            iPos++;
            if (treeItem.indicators.length <= 0) continue;
            if (!treeItem.indicators.includes(1) && !treeItem.indicators.includes(10)) continue;
            lvlNumber++;
            treeItem.indentLevel = lvlNumber;
            for (let i = iPos; ;) {
                var graphId = lstTreeView[i].graphId;
                let allChildItems: Array<TreeView> = lstTreeView.filter((c) => {
                    return c.parentId === graphId;
                });
                let tempLevel = 0;
                if (allChildItems.length > 0) tempLevel = treeItem.indentLevel + 1;
                for (var cItem of allChildItems) {
                    cItem.indentLevel = tempLevel;
                }
                break;
            }
        }
        return lstTreeView;
    };
    setCellValue = function (table: any[][], row: number, column: number, value: string | number): any[][] {
        try {
            table[row][column] = value;
            return table;
        } catch (error) {
            console.log(error);
            return table;
        }
    };
    prepareDecisionMatrix = function (lstTreeView: Array<TreeView>, ifBlockDictionary: [{ treeView: TreeView, decisions: Array<string> }]): string {
        let columnCount: number = lstTreeView.filter((value) => {
            return value.indicators && (value.indicators.includes(1)) || value.indicators.includes(10);
        }).length;
        let conditionsCount: number = lstTreeView.filter((value) => {
            return value.indicators && value.indicators.includes(1);
        }).length;
        let actionsCount: number = lstTreeView.filter((value) => {
            return value.indicators && (!value.indicators.includes(1) && !value.indicators.includes(2));
        }).length;

        let actionStartAt: number = conditionsCount + 1;
        let totalRows: number = (conditionsCount + actionsCount) + 15;
        let matrixTable: Array<Array<string>> = [];
        for (let rows = 0; rows <= totalRows; rows++) {
            let emptyElement: any[] = [];
            for (let cnt = 0; cnt <= columnCount; cnt++) {
                emptyElement.push('');
            }
            matrixTable.push(emptyElement);
        }
        matrixTable = this.setCellValue(matrixTable, 0, 0, "Conditions:");
        matrixTable = this.setCellValue(matrixTable, actionStartAt, 0, "Actions:");

        let bfCounter = 0;
        let iPosition = -1;
        let eRow: number = 0;
        actionStartAt = actionStartAt + 1;
        for (const treeItem of lstTreeView) {
            iPosition++;
            let commandMaster = treeItem.indicators;
            if (commandMaster === null || !(commandMaster.includes(1))) continue;
            for (let i = iPosition; i < lstTreeView.length; i++) {
                var indicators = lstTreeView[i].indicators;
                let indentLevel: number = lstTreeView[i].indentLevel;
                if (indicators && indicators.includes(1)) {
                    eRow++;
                    var statement: string = lstTreeView[i].graphName.stripHtmlTags().trim();
                    this.setCellValue(matrixTable, eRow, 0, statement);
                    this.setCellValue(matrixTable, 0, bfCounter + 1, `BF${bfCounter + 1}`);
                    for (const dict of ifBlockDictionary) {
                        if (dict.treeView.graphId !== lstTreeView[i].graphId) continue;
                        for (let j = 0; j < dict.decisions.length; j++) {
                            this.setCellValue(matrixTable, eRow, bfCounter + 1 + j, dict.decisions[j]);
                        }
                    }
                    bfCounter++;
                    continue;
                }
                if (indicators && indicators.includes(10)) {
                    this.setCellValue(matrixTable, 0, bfCounter + 1, `BF${bfCounter + 1}`);
                    bfCounter++;
                    continue;
                }
                if (indentLevel === 0 || (indicators && indicators.includes(2))) continue;
                if (indicators && (indicators.includes(8) || indicators.includes(9))) continue;

                this.setCellValue(matrixTable, actionStartAt, 0, lstTreeView[i].graphName.stripHtmlTags().trim());
                this.setCellValue(matrixTable, actionStartAt, indentLevel, "X");
                actionStartAt++;
            }
            break;
        }
        let decisionHtml: string = this.prepareDecisionTable(matrixTable);
        return decisionHtml;
    };
    prepareDecisionTable = function (matrixTable: Array<Array<string>>): String {
        let decisionHtml: string = "";
        decisionHtml = decisionHtml.concat("<table class='table table-bordered table-striped users' style='border: none; width: 100%;'>");
        let rowCount: number = -1;

        for (const matrixRow of matrixTable) {
            rowCount++;
            if (matrixRow.every(c => c === "")) continue;
            decisionHtml = decisionHtml.concat("\n", "<tr>");
            let column: number = -1;
            let cellFont: string = "";
            if (rowCount === 0) cellFont = "background-color: black; color: white; width: 20%;";
            var cellTitle: string = matrixTable[rowCount][1];
            let colSpan: number = matrixTable.length;
            for (const cellValue of matrixRow) {
                column++;
                if (cellValue == "Actions:")
                    cellFont = "background-color: black; color: white;";
                if (rowCount == 0 && cellValue !== "Conditions:")
                    cellFont = "background-color: black; color: white; width: 3%;";
                let cellString: string = this.prepareCell(cellTitle, cellValue, colSpan, cellFont);
                decisionHtml = decisionHtml.concat(cellString);
                if (cellValue == "Actions:") break;
            }
            decisionHtml = decisionHtml.concat("</tr>");
        }
        decisionHtml = decisionHtml.concat("\n", "</table>");
        return decisionHtml;
    };
    prepareCell = function (cellTitle: string, cellValue: string, colspan: number, cellFont: string): string {
        let cellString: string;
        if (typeof cellTitle !== "undefined" || cellTitle !== "")
            cellTitle = cellTitle.replace("'", "&apos;").replace(">", "&gt;").replace("<", "&lt;");
        if (typeof cellValue !== "undefined" || cellValue !== "")
            cellValue = cellValue.replace("'", "&apos;").replace(">", "&gt;").replace("<", "&lt;");
        let paddingStyle: string = "";
        switch (cellValue) {
            case "T":
                cellString = "<td title='" + cellTitle + "' style=' " +
                    "" + cellFont + paddingStyle + "; background-color: #8fbc8b; color: white;'>" + cellValue + "</td>";
                break;
            case "F":
                cellString = "<td title='" + cellTitle + "' style=' " +
                    "" + cellFont + paddingStyle + "; background-color: #ed7d31; color: white;'>" + cellValue + "</td>";
                break;
            case "X":
                cellString = "<td title='" + cellTitle + "' style=' " +
                    "" + cellFont + paddingStyle + "; background-color: #2d7b26; color: white;'>" + cellValue + "</td>";
                break;
            case "Actions:":
                cellString = "<td colspan='" + colspan + "' style='" + cellFont + paddingStyle + ";' >" + cellValue + "</td>";
                break;
            default:
                cellString = "<td title='" + cellTitle + "' for='" + this._globalId + "' style='" +
                    cellFont + paddingStyle + "'>" + cellValue + " <em class='cellHelp' id='" + this._globalId +
                    "' title='" + cellTitle + "'></em></td> ";
                break;
        }
        this._globalId++;
        return cellString;
    };
};

const universeArrayExtensions: UniverseArrayExtensions = new UniverseArrayExtensions();

export { universeArrayExtensions, UniverseArrayExtensions };