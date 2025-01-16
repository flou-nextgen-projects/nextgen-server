import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { FileMaster, Link, Node, _createNode } from "../models";
import mongoose, { PipelineStage } from "mongoose";
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
        nodes.push(node);
        for (const callExt of member.callExternals) {
            // at this point we'll call separate function which will get called recursively
            await _expandCallExternals(callExt, node, { nodes, links, index: 0 });
        }
        response.status(200).json({ nodes, links }).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
});

const _expandCallExternals = async (callExt: Partial<FileMaster | any>, node: Node, opt: { nodes: Array<Node>, links: Array<Link>, index: number }) => {
    let pipeLine: Array<PipelineStage> = [
        { $match: { fid: callExt.fid } },
        { $lookup: { from: 'fileMaster', localField: 'fid', foreignField: '_id', as: 'fileMaster' } },
        { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster" } },
        { $lookup: { from: 'fileTypeMaster', localField: 'fileTypeId', foreignField: '_id', as: 'fileMaster.fileTypeMaster' } },
        { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster.fileTypeMaster" } }
    ];
    const member = await appService.memberReferences.aggregateOne(pipeLine);
    // if member is null, simply means - missing object
    if (!member) {
        let nd = { originalIndex: ++opt.index, fileId: callExt._id, id: callExt._id, image: 'missing.png', group: 1, pid: callExt.pid, name: callExt.fileName, fileType: callExt.fileTypeName as any } as Node;
        if ((opt.nodes.findIndex(x => x.name == nd.name) >= 0)) return;
        opt.nodes.push(nd);
        opt.links.push({ source: node.originalIndex, target: nd.originalIndex, weight: 3, linkText: node.name, wid: nd.wid, pid: nd.pid } as any);
    } else {
        let nd: Node = _createNode(member.fileMaster, ++opt.index);
        if ((opt.nodes.findIndex(x => x.name == nd.name) >= 0)) return;
        opt.nodes.push(nd);
        opt.links.push({ source: node.originalIndex, target: nd.originalIndex, weight: 3, linkText: node.name, wid: nd.wid, pid: nd.pid } as any);
        if (member.callExternals.length === 0) return;
        for (const callE of member.callExternals) {
            await _expandCallExternals(callE, nd, { nodes: opt.nodes, links: opt.links, index: ++opt.index });
        }
    }
};

module.exports = dependencyRouter;