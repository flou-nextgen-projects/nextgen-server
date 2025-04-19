import Mongoose from "mongoose";
import { parse } from "path";
import { FileMaster } from "./file-master";
import _ from "lodash";

export class Node {
    public wid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public fileId: Mongoose.Types.ObjectId | string;
    public name: string;
    public group: number;
    public image: string;
    public id: string;
    public info: { root: string, dir: string, base: string, ext: string, name: string }
    public type: NodeLinkType = NodeLinkType.node;
    public filePath: string;
    public fileType: string; public color?: string;
    public summary?: string;
};
export class Link {
    public wid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public weight: number;
    public linkText: string;
    public type: NodeLinkType = NodeLinkType.link;
    public srcFileId?: Mongoose.Types.ObjectId | string;
    public tarFileId?: Mongoose.Types.ObjectId | string;
    public source?: number; public target?: number;
};
export const _createNode = function (fileData: FileMaster) {
    let image = fileData.fileTypeMaster?.img || "object-node.png";
    let color = fileData.fileTypeMaster?.color || '#c0c0c0';
    return {
        name: fileData.fileName, group: 1,
        image, id: fileData._id.toString(),
        pid: fileData.pid, wid: fileData.wid,
        fileId: fileData._id.toString(),
        info: parse(fileData.filePath),
        fileType: fileData.fileTypeMaster.fileTypeName, type: NodeLinkType.node,
        filePath: fileData.filePath, color, 
        aid: fileData.aid
    };
};
export const prepareNodes = function (inputData: any[] = []): Array<Node> {
    const nodes: Array<Node> = [];
    inputData.forEach((fileData) => {
        const node = _createNode(fileData);
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
            weight: 3,
            srcFileId: Mongoose.Types.ObjectId.createFromHexString(nj.srcFileId),
            tarFileId: Mongoose.Types.ObjectId.createFromHexString(nj.tarFileId),
            linkText: nj.linkText,
            type: NodeLinkType.link,
            source: nj.source, target: nj.target
        });
    });
    return links;
};
export const resetNodeAndLinkIndex = (nodes: Array<Node | any>, links: Array<Link | any>) => {
    // set original index of each node
    nodes.forEach((node, index) => { node.originalIndex = index; });
    // we need to set source and target index for each link depending on the node index
    links.forEach((link) => {
        const sourceNode = nodes.find((node) => node._id.toString() === link.srcFileId.toString());
        const targetNode = nodes.find((node) => node._id.toString() === link.tarFileId.toString());
        if (!sourceNode || !targetNode) return;
        if (sourceNode.originalIndex === targetNode.originalIndex) return;
        link.source = sourceNode.originalIndex;
        link.target = targetNode.originalIndex;
    });
    return { nodes, links };
}
export enum NodeLinkType {
    node = 1, link = 2, entity = 3
}