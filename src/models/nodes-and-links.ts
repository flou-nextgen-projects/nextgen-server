import Mongoose, { ObjectId } from "mongoose";
import { parse } from "path";
import { FileMaster } from "./file-master";

export class Node {
    public wid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public fileId: Mongoose.Types.ObjectId | string;
    public name: string;
    public group: number;
    public image: string;
    public id: string;
    public originalIndex: number;
    public info: { root: string, dir: string, base: string, ext: string, name: string }
    public type: NodeLinkType = NodeLinkType.node;
    public filePath: string;
    public fileType: string;
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
const _createNode = function (fileData: FileMaster, originalIndex: number) {
    let image = fileData.fileTypeMaster?.img || "object-node.png";
    return {
        name: fileData.fileName, group: 1,
        image, id: fileData._id.toString(),
        originalIndex, pid: fileData.pid, wid: fileData.wid,
        fileId: fileData._id,
        info: parse(fileData.filePath),
        fileType: fileData.fileTypeMaster.fileTypeName, type: NodeLinkType.node,
        filePath: fileData.filePath,
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
export const prepareDotNetLinks = function (inputData: any[], nodes: Array<Node>) {
    const links: Array<Link> = [];
    inputData.forEach((fileData) => {
        if (!fileData.MethodCallers || fileData.MethodCallers.length <= 0) return;
        fileData.MethodCallers.forEach((callFile: any) => {
            const sourceNodeIndex = nodes.findIndex((node) => node.fileId.toString() === callFile.FileId);
            const targetNodeIndex = nodes.findIndex((node) => node.fileId.toString() === fileData.FileId);
            if (sourceNodeIndex === -1 || targetNodeIndex === -1) return;
            if (callFile.FileId === fileData.FileId) return;
            let exists = links.find((link) => link.target === targetNodeIndex && link.source === sourceNodeIndex);
            if (exists) return;
            links.push({
                wid: fileData.WorkspaceId,
                pid: Mongoose.Types.ObjectId.createFromHexString(callFile.ProjectId),
                source: sourceNodeIndex, target: targetNodeIndex, weight: 3,
                srcFileId: Mongoose.Types.ObjectId.createFromHexString(callFile.FileId),
                tarFileId: Mongoose.Types.ObjectId.createFromHexString(fileData.FileId),
                linkText: callFile.CallingMethod,
                type: NodeLinkType.link
            });
        });
    });
    return links;
};
export const prepareLinks = function (inputData: any[], nodes: Array<Node>): Array<Link> {
    const links: Array<Link> = [];
    inputData.forEach((fileData, index) => {
        if (!fileData.CallExternals || fileData.CallExternals.length <= 0) return;
        fileData.CallExternals.forEach((externalFile: any) => {
            const targetNodeIndex = nodes.findIndex((node) => node.info.name === externalFile.FileName && node.fileType.toLowerCase() === externalFile.FileType.toLowerCase());
            if (targetNodeIndex === -1) return; // that means, this is missing file // TODO: check it later
            let exists = links.find((link) => link.source === index && link.target === targetNodeIndex);
            if (exists) return;
            links.push({
                wid: Mongoose.Types.ObjectId.createFromHexString(fileData.WorkspaceId),
                pid: Mongoose.Types.ObjectId.createFromHexString(fileData.ProjectId),
                source: index,
                target: targetNodeIndex,
                weight: 3, linkText: externalFile.FileName,
                type: NodeLinkType.link
            });
        });
    });
    return links;
};
export enum NodeLinkType {
    node = 1, link = 2,
}