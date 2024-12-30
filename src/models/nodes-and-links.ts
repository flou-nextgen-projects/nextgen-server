import Mongoose from "mongoose";
import { parse } from "path";
import { FileTypeMaster } from "./file-type-master";
import { FileMaster } from "./file-master";

export class Node {
    public name: string;
    public group: number;
    public image: string;
    public id: string;
    public originalIndex: number;
    public pid: Mongoose.Types.ObjectId | string;
    public fileId: Mongoose.Types.ObjectId | string;
    public info: { root: string, dir: string, base: string, ext: string, name: string }
    public type: NodeLinkType = NodeLinkType.node;
    public filePath: string;
    public fileType: string;
};
export class Link {
    public pid?: Mongoose.Types.ObjectId | string;
    public source: number;
    public target: number;
    public weight: number;
    public linkText: string;
    public type: NodeLinkType = NodeLinkType.link;
};
const _createNode = function (fileData: FileMaster, originalIndex: number) {
    let image = fileData.fileTypeMaster?.img || "object-node.png";
    return {
        name: fileData.fileName, group: 1,
        image, id: fileData._id.toString(),
        originalIndex, pid: fileData.pid,
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
    inputData.forEach((fileData, index) => {
        if (!fileData.MethodCallers || fileData.MethodCallers.length <= 0) return;
        fileData.MethodCallers.forEach((callFile: any) => {
            const sourceNodeIndex = nodes.findIndex((node) => node.fileId.toString() === callFile.FileId && node.pid.toString() === callFile.ProjectId);
            if (sourceNodeIndex === -1) return;
            let exists = links.find((link) => link.target === index && link.source === sourceNodeIndex);
            if (exists) return;
            links.push({ source: sourceNodeIndex, target: index, weight: 3, linkText: callFile.CallingMethod, type: NodeLinkType.link });
        });
    });
    return links;
};
export const prepareLinks = function (inputData: any[], nodes: Array<Node>): Array<Link> {
    const links: Array<Link> = [];
    inputData.forEach((fileData, index) => {
        if (!fileData.CallExternals || fileData.CallExternals.length <= 0) return;
        fileData.CallExternals.forEach((externalFile: any) => {
            const targetNodeIndex = nodes.findIndex((node) => node.info.name === externalFile.FileName);
            if (targetNodeIndex === -1) return;
            let exists = links.find((link) => link.source === index && link.target === targetNodeIndex);
            if (exists) return;
            links.push({ source: index, target: targetNodeIndex, weight: 3, linkText: externalFile.FileName, type: NodeLinkType.link });
        });
    });
    return links;
};
export enum NodeLinkType {
    node = 1, link = 2,
}