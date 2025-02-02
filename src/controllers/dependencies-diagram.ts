import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { FileMaster, Link, Node, _createNode } from "../models";
import mongoose, { PipelineStage } from "mongoose";
import { ObjectId } from "mongodb";

const dependencyRouter: Router = Express.Router();
dependencyRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async (request: Request, response: Response) => {
    try {
        let fid = <string>request.query.fid;
        let pipeLine: Array<PipelineStage> = [
            { $match: { fid: mongoose.Types.ObjectId.createFromHexString(fid) } },
            { $lookup: { from: 'fileMaster', localField: 'fid', foreignField: '_id', as: 'fileMaster' } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster" } },
            { $lookup: { from: 'fileTypeMaster', localField: 'fileTypeId', foreignField: '_id', as: 'fileMaster.fileTypeMaster' } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster.fileTypeMaster" } }
        ];
        const member = await appService.memberReferences.aggregateOne(pipeLine);
        if (!member) return response.status(404).json({ message: 'Not found' }).send().end();
        // if member reference is present, then we need to get all call externals and loop through all elements        
        // since, this data is going for d3 network, we'll prepare elements in that way
        // this will be a focal node and all node elements will be of type Node and links will be of type Link
        let links: Array<Link> = [];
        let nodes: Array<Node> = [];
        let node: Node = _createNode(member.fileMaster, 0);
        nodes.push({ ...node, image: 'focal-node.png', color: member.fileMaster.fileTypeMaster.color });
        let skipTypes: Array<string> = ["BMS", "COPYBOOK", "INCLUDE", "INPUTLIB"].map((d) => d.toLowerCase());
        for (const callExt of member.callExternals) {
            // at this point we'll call separate function which will get called recursively
            if (skipTypes.includes(callExt.fileTypeName.toLowerCase())) continue;
            await _expandCallExternals(callExt, node, { nodes, links, index: 0, skipTypes });
        }
        await _expandParentCalls({ nodes, links, index: nodes.length + 1 }, node);
        response.status(200).json({ nodes, links }).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
});

const _expandCallExternals = async (callExt: Partial<FileMaster | any>, node: Node, opt: { nodes: Array<Node>, links: Array<Link>, index: number, skipTypes: Array<string> }) => {
    let pipeLine: Array<PipelineStage> = [
        { $match: { fid: callExt.fid } },
        { $lookup: { from: 'fileMaster', localField: 'fid', foreignField: '_id', as: 'fileMaster' } },
        { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster" } },
        { $lookup: { from: 'fileTypeMaster', localField: 'fileTypeId', foreignField: '_id', as: 'fileMaster.fileTypeMaster' } },
        { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster.fileTypeMaster" } }
    ];
    const member = await appService.memberReferences.aggregateOne(pipeLine);
    // if member is null, simply means - missing object
    if (!member) return;
    if ((opt.nodes.findIndex((x) => x.name == member.fileMaster.fileName) >= 0)) {
        let existsIndex: number = opt.nodes.findIndex((x) => x.name === member.fileMaster.fileName);
        let srcIdx = opt.nodes.findIndex((x) => x.name === node.name);
        opt.links.push({ source: srcIdx, target: existsIndex, weight: 3, linkText: node.name } as any);
        return;
    }
    let nd: Node = _createNode(member.fileMaster, ++opt.index);
    opt.nodes.push(nd);
    let targetIdx: number = opt.nodes.findIndex(x => x.name === nd.name);
    let srcIdx = opt.nodes.findIndex((x) => x.name === node.name);
    opt.links.push({ source: srcIdx, target: targetIdx, weight: 3, linkText: node.name } as any);
    if (member.callExternals.length === 0) return;
    for (const callE of member.callExternals) {
        if (opt.skipTypes.includes(callE.fileTypeName.toLowerCase())) continue;
        await _expandCallExternals(callE, nd, { nodes: opt.nodes, links: opt.links, index: opt.index, skipTypes: opt.skipTypes });
    }
};

const _expandParentCalls = async (opt: { nodes: Array<Node>, links: Array<Link>, index: number }, node: Node) => {
    try {
        let pipeLine = [{ $match: { callExternals: { $elemMatch: { fid: new ObjectId(node.fileId) } } } },
        { $lookup: { from: "fileMaster", localField: "fid", foreignField: "_id", as: "fileMaster" } },
        { $unwind: { path: "$fileMaster", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "fileTypeMaster", localField: "fileMaster.fileTypeId", foreignField: "_id", as: "fileMaster.fileTypeMaster" } },
        { $unwind: { path: "$fileMaster.fileTypeMaster", preserveNullAndEmptyArrays: true } }];
        let members = await appService.memberReferences.aggregate(pipeLine);
        for (const element of members) {
            if (element.callExternals.length == 0) continue;
            let callExts = element.callExternals.filter((x: any) => { return x.fid.toString() == node.fileId });
            if (callExts.length <= 0) continue;
            let findEle = opt.nodes.find((y) => y.name === element.fileMaster.fileName);
            if (!findEle) {
                var parentNode: Node = _createNode(element.fileMaster, ++opt.index);
                opt.nodes.push(parentNode);
            }
            let parentIdx = opt.nodes.findIndex((y) => y.name === element.fileMaster.fileName);
            let nodeIdx: number = opt.nodes.findIndex((x) => x.name === node.name);
            opt.links.push({ source: parentIdx, target: nodeIdx, weight: 3, linkText: node.name } as any);
        }
    } catch (error) {
        console.log(error);
    }
}

module.exports = dependencyRouter;