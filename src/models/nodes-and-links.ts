import Mongoose from "mongoose";
import { parse } from "path";
import { FileMaster } from "./file-master";

export class Node {
    public wid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public fileId: Mongoose.Types.ObjectId | string;
    public name: string;
    public group: number;
    public image: string;
    public id?: string;
    public originalIndex: number;
    public info: { root: string, dir: string, base: string, ext: string, name: string }
    public type: NodeLinkType = NodeLinkType.node;
    public filePath: string;
    public fileType: string; public color?: string;
    public summary?: string;
};
export class Link {
    public wid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public source: number;
    public target: number;
    public weight: number;
    public linkText: string;
    public type: NodeLinkType = NodeLinkType.link;
    public srcFileId?: Mongoose.Types.ObjectId | string;
    public tarFileId?: Mongoose.Types.ObjectId | string;
};
export const _createNode = function (fileData: FileMaster, originalIndex: number) {
    let image = fileData.fileTypeMaster?.img || "object-node.png";
    let color = fileData.fileTypeMaster?.color || '#c0c0c0';
    return {
        name: fileData.fileName, group: 1, image, 
        originalIndex, pid: fileData.pid, wid: fileData.wid,
        fileId: fileData._id.toString(),
        info: parse(fileData.filePath),
        fileType: fileData.fileTypeMaster.fileTypeName, type: NodeLinkType.node,
        filePath: fileData.filePath, color, aid: fileData.aid || Mongoose.Types.ObjectId.generate(),
    };
};
export const prepareNodes = function (inputData: any[] = []): Array<Node> {
    const nodes: Array<Node> = [];
    inputData.forEach((fileData, index) => {
        const node = _createNode(fileData, index);
        nodes.push(node);
    });
    return nodes;
};
export const prepareDotNetLinks = function (networkJson: any[]) {
    const links: Array<Link> = [];
    networkJson.forEach((nj) => {
        links.push({
            wid: Mongoose.Types.ObjectId.createFromHexString(nj.wid),
            pid: Mongoose.Types.ObjectId.createFromHexString(nj.pid),
            source: nj.source, target: nj.target, weight: 3,
            srcFileId: Mongoose.Types.ObjectId.createFromHexString(nj.srcFileId),
            tarFileId: Mongoose.Types.ObjectId.createFromHexString(nj.tarFileId),
            linkText: nj.linkText,
            type: NodeLinkType.link
        });
    });
    return links;
};
export const prepareLinks = function (inputData: any[], nodes: Array<Node>): Array<Link> {
    const links: Array<Link> = [];
    inputData.forEach((fileData) => {
        if (!fileData.CallExternals || fileData.CallExternals.length <= 0) return;
        fileData.CallExternals.forEach((externalFile: any) => {
            const sourceNodeIndex = nodes.findIndex((node) => node.id === fileData._id);
            const targetNodeIndex = nodes.findIndex((node) => node.id === externalFile._id);
            if (targetNodeIndex === -1 || sourceNodeIndex === -1) return;
            let exists = links.find((link) => link.source === sourceNodeIndex && link.target === targetNodeIndex);
            if (exists) return;
            links.push({
                wid: Mongoose.Types.ObjectId.createFromHexString(fileData.WorkspaceId),
                pid: Mongoose.Types.ObjectId.createFromHexString(fileData.ProjectId),
                source: sourceNodeIndex,
                target: targetNodeIndex,
                weight: 3, linkText: externalFile.FileName,
                type: NodeLinkType.link
            });
        });
    });
    return links;
};
export enum NodeLinkType {
    node = 1, link = 2, entity = 3
}