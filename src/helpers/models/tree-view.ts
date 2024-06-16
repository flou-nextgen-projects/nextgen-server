import { StatementMaster } from "../../models";

export default class TreeView {
    public nodeId: number;
    public hasChild: boolean;
    public graphId: string;
    public graphName: string;
    public parentId: string;
    public spriteCssClass: string;
    public baseCommandId: number;
    public indicators: Array<number> = [];
    public primaryCommandId: number;
    public classCalled: string;
    public methodCalled: string;
    public actualStatementId: string;
    public statementMaster: StatementMaster;
    public actionWorkflowId: number;
    public groupName: string;
    public groupId: number;
    public programId: number;
    public done: boolean;
    public alternateName: string;
    public businessName: string;
    public annotateStatement: string;
    public globalParentId: string;
    public statementId: string;
    public indentLevel: number;

    public prepareTreeViewNode = function (graphId: string, parentId: string, treeNodeId: number, pseudoCode: boolean, statementReference: StatementMaster) {
        var gName = pseudoCode ? typeof statementReference.alternateName !== "undefined" ? statementReference.alternateName : statementReference.originalLine : statementReference.originalLine;
        var treeItem: TreeView = {
            graphId,
            graphName: gName,
            hasChild: true,
            parentId: parentId,
            baseCommandId: statementReference.indicators,
            statementReference,
            actualStatementId: "actual-" + statementReference._id.toString(),
            nodeId: ++treeNodeId,
            alternateName: statementReference.alternateName,
            groupName: statementReference?.businessName,
            businessName: statementReference?.businessName,
            spriteCssClass: ""
        } as unknown as TreeView;
        return treeItem;
    };
}