import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { FileMaster, Link, Node, NodeLinkType, _createNode } from "../models";
import mongoose, { PipelineStage } from "mongoose";
import { ObjectId } from "mongodb";
import configs from "../configurations";
import axios from "axios";
import { Agent } from 'https';

const dependencyRouter: Router = Express.Router();
const genAiAddress: string = configs.genAIUrl;
const axiosInstance: any = axios.create({ httpsAgent: new Agent({ rejectUnauthorized: false }) });

dependencyRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async (request: Request, response: Response) => {
    try {
        let fid = <string>request.query.fid;
        let populateEntities = request.query.getEntities;
        let addBusinessSummaries = request.query.business || false;
        let pipeLine: Array<PipelineStage> = [
            { $match: { _id: mongoose.Types.ObjectId.createFromHexString(fid) } },
            { $lookup: { from: 'fileMaster', localField: 'fid', foreignField: '_id', as: 'fileMaster' } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster" } },
            { $lookup: { from: 'fileTypeMaster', localField: 'fileMaster.fileTypeId', foreignField: '_id', as: 'fileMaster.fileTypeMaster' } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster.fileTypeMaster" } }
        ];
        const member = await appService.memberReferences.aggregateOne(pipeLine);
        if (!member) return response.status(404).json({ message: 'Not found' }).send().end();
        // if member reference is present, then we need to get all call externals and loop through all elements        
        // since, this data is going for d3 network, we'll prepare elements in that way
        // this will be a focal node and all node elements will be of type Node and links will be of type Link
        let node: any = { ...member, fileId: member.fid.toString(), aid: member._id.toString() };
        let links: Array<Link> = [];
        let nodes: Array<Node | any> = [{ ...node, image: 'focal-node.png', color: member.fileMaster.fileTypeMaster.color }];
        for (const callExt of member?.callExternals) {
            // at this point we'll call separate function which will get called recursively
            if (["bms", "copybook", "include", "inputlib"].includes(callExt.fileTypeName.toLowerCase())) continue;
            let needToSkipTypes = ["bms", "copybook", "include", "inputlib"];
            await _expandCallExternals(callExt, node, { nodes, links, index: 0, needToSkipTypes });
        }
        await _expandParentCalls({ nodes, links, index: nodes.length + 1 }, node);
        if (populateEntities === "true") {
            await _attachEntityNodes({ nodes, links, index: nodes.length + 1 }, request.headers.authorization);
        }
        if (addBusinessSummaries === "true") {
            await _attachedBusinessSummaries({ nodes, links, index: nodes.length + 1 }, request.headers.authorization);
        }
        if (member.callers && member.callers.length > 0) {
            await _expandCallers(node, { nodes, links, index: nodes.length + 1 });
        }
        response.status(200).json({ nodes, links }).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
});

const _expandCallers = async (node: any, opt: { nodes: Array<Node | any>, links: Array<Link>, index: number }) => {
    try {
        for (const caller of node.callers) {
            let pipeLine = [{ $match: { fid: new ObjectId(caller.fid.toString() as string), location: caller.location, callingMethod: caller.callingMethod } },
            { $lookup: { from: "fileMaster", localField: "fid", foreignField: "_id", as: "fileMaster" } },
            { $unwind: { path: "$fileMaster", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "fileTypeMaster", localField: "fileMaster.fileTypeId", foreignField: "_id", as: "fileMaster.fileTypeMaster" } },
            { $unwind: { path: "$fileMaster.fileTypeMaster", preserveNullAndEmptyArrays: true } }];
            let members = await appService.memberReferences.aggregate(pipeLine);
            for (const member of members) {
                // again member will have caller, so if it is, then we need to add a node and link and call this function again
                let findEle = opt.nodes.find((y) => y.memberName === member.memberName);
                if (!findEle) {
                    var parentNode: Node = { ...member, fileId: member.fid.toString(), aid: member._id.toString() };
                    opt.nodes.push(parentNode);
                }
                let parentIdx = opt.nodes.findIndex((y) => y.memberName === member.memberName);
                let nodeIdx: number = opt.nodes.findIndex((x) => x.memberName === node.memberName);
                opt.links.push({ source: parentIdx, target: nodeIdx, weight: 3, linkText: node.name } as any);
            }
        }
    } catch (error) {
        console.log(error);
    }
};
const _expandCallExternals = async (callExt: Partial<FileMaster | any>, node: Node, opt: { nodes: Array<Node>, links: Array<Link>, index: number, needToSkipTypes: Array<string> }) => {
    let pipeLine: Array<PipelineStage> = [
        { $match: { fid: callExt.fid } },
        { $lookup: { from: 'fileMaster', localField: 'fid', foreignField: '_id', as: 'fileMaster' } },
        { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster" } },
        { $lookup: { from: 'fileTypeMaster', localField: 'fileMaster.fileTypeId', foreignField: '_id', as: 'fileMaster.fileTypeMaster' } },
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
    let nd: any = { ...member, fileId: member.fid.toString(), aid: member._id.toString() };
    opt.nodes.push(nd);
    let targetIdx: number = opt.nodes.findIndex(x => x.name === nd.name);
    let srcIdx = opt.nodes.findIndex((x) => x.name === node.name);
    opt.links.push({ source: srcIdx, target: targetIdx, weight: 3, linkText: node.name } as any);
    if (member.callExternals.length === 0) return;
    for (const callE of member.callExternals) {
        if (opt.needToSkipTypes.includes(callE.fileTypeName.toLowerCase())) continue;
        await _expandCallExternals(callE, nd, { nodes: opt.nodes, links: opt.links, index: opt.index, needToSkipTypes: opt.needToSkipTypes });
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
        for (const member of members) {
            if (member.callExternals.length == 0) continue;
            let callExts = member.callExternals.filter((x: any) => { return x.fid.toString() == node.fileId });
            if (callExts.length <= 0) continue;
            let findEle = opt.nodes.find((y) => y.name === member.fileMaster.fileName);
            if (!findEle) {
                var parentNode: Node = { ...member, fileId: member.fid.toString(), aid: member._id.toString() };
                opt.nodes.push(parentNode);
            }
            let parentIdx = opt.nodes.findIndex((y) => y.name === member.fileMaster.fileName);
            let nodeIdx: number = opt.nodes.findIndex((x) => x.name === node.name);
            opt.links.push({ source: parentIdx, target: nodeIdx, weight: 3, linkText: node.name } as any);
        }
    } catch (error) {
        console.log(error);
    }
};
const _attachEntityNodes = async (opt: { nodes: Array<Node>, links: Array<Link>, index: number }, authToken: string) => {
    for (const node of opt.nodes) {
        if (node.type == NodeLinkType.entity) continue;
        let entity = await appService.entityMaster.getItem({ fid: mongoose.Types.ObjectId.createFromHexString(node.fileId.toString()) });
        if (entity && entity.entityName == "None") continue;
        let entities = await appService.entityMaster.getDocuments({ fid: mongoose.Types.ObjectId.createFromHexString(node.fileId.toString()) });
        if (entities.length == 0) {
            let fileContents = await appService.fileContentMaster.getItem({ fid: new ObjectId(node.fileId) });
            try {
                const result = await axiosInstance.post(`${genAiAddress}multi-model-handler`, {
                    promptId: 1001, fileData: fileContents.formatted,
                    language: "COBOL", fid: node.fileId, reGen: false
                }, {
                    headers: {
                        Authorization: `${authToken}`
                    }
                });
                if (result.data) {
                    let entityNode: Node = {
                        name: "", group: 3, image: "sql.png",
                        id: `entity-${node.fileId.toString()}`, pid: node.pid, wid: node.wid, fileId: node.fileId.toString(), type: NodeLinkType.entity,
                    } as Node;
                    opt.nodes.push(entityNode);
                    let parentIdx = opt.nodes.findIndex((x) => x.name === node.name);;
                    let targetIdx = opt.nodes.findIndex((x) => x.id === `entity-${node.fileId.toString()}`);;
                    opt.links.push({ source: parentIdx, target: targetIdx, weight: 3, linkText: entityNode.name } as any);
                }
            } catch (err) {
                console.log(err);
            }
        } else {
            let entityNode: Node = {
                name: "", group: 3, image: "sql.png",
                id: `entity-${node.fileId.toString()}`, pid: node.pid, wid: node.wid,
                fileId: node.fileId.toString(), type: NodeLinkType.entity,
            } as Node;
            opt.nodes.push(entityNode);
            let parentIdx = opt.nodes.findIndex((x) => x.name === node.name);;
            let targetIdx = opt.nodes.findIndex((x) => x.id === `entity-${node.fileId.toString()}`);;
            opt.links.push({ source: parentIdx, target: targetIdx, weight: 3, linkText: entityNode.name } as any);
        }
    }
};
const _attachedBusinessSummaries = async (opt: { nodes: Array<Node>, links: Array<Link>, index: number }, authToken: string) => {
    for (const node of opt.nodes) {
        let summary = await appService.mongooseConnection.collection("businessSummaries").findOne({ fid: new ObjectId(node.fileId), promptId: 1022 });
        if (summary) {
            node.summary = summary.formattedData;
        }
    }
};

module.exports = dependencyRouter;