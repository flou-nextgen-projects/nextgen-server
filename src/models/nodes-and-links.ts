import Mongoose from "mongoose";
import { parse } from "path";

export class Node {
    public name: string;
    public group: number;
    public image: string;
    public id: number;
    public originalIndex: number;
    public pid: Mongoose.Types.ObjectId | string;
    public fileId: Mongoose.Types.ObjectId | string;
    public info: { root: string, dir: string, base: string, ext: string, name: string }
    public type: string = "node";
    public filePath: string;
    public fileType: string;
};
export class Link {
    public pid: Mongoose.Types.ObjectId | string;
    public source: number;
    public target: number;
    public weight: number;
    public linkText: string;
    public type: string = "link";
};
const _createNode = function (fileData: any, originalIndex: number) {
    const fileType = fileData.FileType.toLowerCase();
    let image = '';
    switch (fileType) {
        case 'copybook':
            image = 'copybook.png';
            break;
        case 'program':
            image = 'program.png';
            break;
        case 'inputLib':
            image = 'inputLib.png';
            break;
        case 'jcl':
            image = 'jcl.png';
            break;
        case 'proc':
            image = 'proc.png';
            break;
        case 'screen':
            image = 'screen.png';
            break;
        case 'missing':
            image = 'missing.png';
            break;
        case 'bms':
            image = 'screen.png';
            break;
        default:
            image = 'object-node.png';
    }
    return {
        name: fileData.FileName, group: 1,
        image, id: fileData.FileId,
        originalIndex, pid: '',
        fileId: fileData.FileId,
        info: parse(fileData.FilePath),
        fileType: fileData.FileType, type: "node",
        filePath: fileData.FilePath, // added for future use. currently not used in the code.
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
export const prepareLinks = function (inputData: any[], nodes: Array<Node>): Array<Link> {
    const links: Array<Link> = [];
    inputData.forEach((fileData, index) => {
        if (!fileData.CallExternals || fileData.CallExternals.length <= 0) return;
        fileData.CallExternals.forEach((externalFile: any) => {
            const externalNodeIndex = nodes.findIndex((node) => node.info.name === externalFile.FileName);
            if (externalNodeIndex === -1) return;
            let exists = links.find((link) => link.source === index && link.target === externalNodeIndex);
            if (exists) return;
            links.push({ source: index, target: externalNodeIndex, weight: 3, linkText: externalFile.FileName, pid: '', type: "link" });
        });
    });
    return links;
};