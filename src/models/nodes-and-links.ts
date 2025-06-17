import Mongoose from "mongoose";
import { parse } from "path";
import { FileMaster } from "./file-master";
import _ from "lodash";
import { link } from "fs";

export class Node {
    public wid: Mongoose.Types.ObjectId | string;
    public pid: Mongoose.Types.ObjectId | string;
    public fileId: Mongoose.Types.ObjectId | string;
    public name: string;
    public originalName?: string;
    public originalIndex?: number;
    public group: number;
    public image: string;
    public id: string;
    public info: { root: string, dir: string, base: string, ext: string, name: string }
    public type: NodeLinkType = NodeLinkType.node;
    public filePath: string;
    public fileType: string; public color?: string;
    public summary?: string;
    public entities?: Array<any>;
    public inputDataSet?: string;
    public outputDataSet?: string;
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
    return links;
};
export const filterNodes = function (nodes: Array<any>, links: Array<any>): Array<any> {
    // we need to filter nodes based on links sourceId and targetId
    let filteredNodes: Array<any> = [];
    if (links.length == 0) return nodes;
    links.forEach((link) => {
        const sourceNode = nodes.find((node) => node.methodId.toString() === link.sourceId.toString());
        const targetNode = nodes.find((node) => node.methodId.toString() === link.targetId.toString());
        if (sourceNode && !filteredNodes.find((node) => node.methodId.toString() === sourceNode.methodId.toString())) {
            filteredNodes.push(sourceNode);
        }
        if (targetNode && !filteredNodes.find((node) => node.methodId.toString() === targetNode.methodId.toString())) {
            filteredNodes.push(targetNode);
        }
    });
    return filteredNodes;
};
export const adjustLinks = function (nodes: Array<any>, links: any[]): Array<Link> {
    const newLinks: Array<Link> = [];
    links.forEach((link) => {
        const sourceNodeIndex = nodes.findIndex((node) => node.methodId.toString() === link.sourceId.toString());
        const targetNodeIndex = nodes.findIndex((node) => node.methodId.toString() === link.targetId.toString());
        if (targetNodeIndex === -1 || sourceNodeIndex === -1) return;
        let exists = newLinks.find((link) => link.source === sourceNodeIndex && link.target === targetNodeIndex);
        if (exists) return;
        newLinks.push({ ...link, source: sourceNodeIndex, target: targetNodeIndex });
    });
    return newLinks;
};
export const findAllParentsAndTheirLinks = function (nodeDetail: Array<any>, linkDetails: Array<any>) {
    // this is the strategy to find all parents and their links
    // 1. for each node in nodeDetail, find its parent node via linkDetails where take all links where target is the current node
    // 2. recursively find all parents of the parent node until we reach the root node
    // 3. repeat step 1 for each parent node found in step 2
    // 4. from linkDetails, find all links where source is the current node or any of its parent nodes
    const parentNodes: Array<any> = [];
    const parentLinks: Array<any> = [];
    const findParents = (node: any) => {
        // find parent node
        const parentLink = linkDetails.find((link) => link.targetId === node.methodId);
        if (parentLink) {
            const parentNode = nodeDetail.find((n) => n.methodId.toString() === parentLink.sourceId.toString());
            if (parentNode && !parentNodes.find((n) => n.methodId === parentNode.methodId)) {
                parentNodes.push(parentNode);
                findParents(parentNode);
            }
        }
    }
}

export enum NodeLinkType {
    node = 1, link = 2, entity = 3, InputOutputInterface = 4
}