import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { FileMaster, Link, Node, NodeLinkType, _createNode } from "../models";
import mongoose, { Mongoose, PipelineStage } from "mongoose";
import { ObjectId } from "mongodb";
import configs from "../configurations";
import extractDataEntities from "../helpers/common/entity-master-helper";

import axios from "axios";
import { Agent } from 'https';

const dependencyRouter: Router = Express.Router();
const genAiAddress: string = configs.genAIUrl;
const axiosInstance: any = axios.create({
    httpsAgent: new Agent({
        rejectUnauthorized: false
    })
});

dependencyRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async (request: Request, response: Response) => {
    try {
        let fid = <string>request.query.fid;
        let populateEntities = request.query.getEntities;
        let addBusinessSummaries = request.query.business || false;
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
        if (populateEntities === "true") {
            await _attachEntityNodes({ nodes, links, index: nodes.length + 1 }, request.headers.authorization);
        }
        if (addBusinessSummaries === "true") {
            await _attachedBusinessSummaries({ nodes, links, index: nodes.length + 1 }, request.headers.authorization);
        }
        // _assignLinkTexts(links);
        response.status(200).json({ nodes, links }).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
});
const _attachedBusinessSummaries = async (opt: { nodes: Array<Node>, links: Array<Link>, index: number }, authToken: string) => {
    for (const node of opt.nodes) {
        let summary = await appService.mongooseConnection.collection("businessSummaries").findOne({ fid: new ObjectId(node.fileId), promptId: 1022 });
        if (summary) {
            node.summary = summary.formattedData;
        }
    }
}
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
};

const _assignLinkTexts = function (links: Array<Link>) {
    const linkMap = new Map<number, Array<Link>>();
    links.forEach(link => {
        if (!linkMap.has(link.source)) {
            linkMap.set(link.source, []);
        }
        linkMap.get(link.source).push(link);
    });

    const dfs = (source: number, prefix: string) => {
        const children = linkMap.get(source) || [];
        children.forEach((link, index) => {
            const linkText = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
            link.linkText = linkText;
            dfs(link.target, linkText);
        });
    };

    dfs(0, "");
};

const _attachEntityNodes = async (opt: { nodes: Array<Node>, links: Array<Link>, index: number }, authToken: string) => {
    for (const node of opt.nodes) {
        if (node.type == NodeLinkType.entity) continue;
        let entities = await appService.entityMaster.getDocuments({ fid: mongoose.Types.ObjectId.createFromHexString(node.fileId.toString()) });
        if (entities.length == 0) {
            // send request to multi-handler-api to get entities and save it into database
            let fileContents = await appService.fileContentMaster.getItem({ fid: new ObjectId(node.fileId) });
            try {
                const result = await axiosInstance.post(
                    `${genAiAddress}multi-model-handler`,
                    {
                        promptId: 1001,
                        fileData: fileContents.formatted,
                        language: "COBOL",
                        fid: node.fileId,
                        reGen: false
                    },
                    {
                        headers: {
                            Authorization: `${authToken}`
                        }
                    }
                );
                // let formattedRes = result.data.response.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
                /*const cleanedString = formattedRes.replace(/```json|```/g, '').trim();
                let variableDetails = {
                    type: "Variable & Data Element",
                    promptId: 1001,
                    fid: node.fileId,// mongoose.Types.ObjectId.createFromHexString(node.fileId),
                    data: JSON.stringify(cleanedString),
                    formattedData: JSON.stringify(cleanedString),
                    genAIGenerated: false
                } as any;
                await appService.mongooseConnection.collection("businessSummaries").insertOne(variableDetails);*/
                // let extractedJson = extractJson(cleanedString);
                // let res = await extractDataEntities(extractedJson, node.pid.toString(), node.fileId.toString());
                // if res.code==3 means json is invalid we need to handle this situation
                if (result.data) {
                    let entityNode: Node = {
                        name: "",
                        group: 3,
                        image: "sql.png",
                        id: `entity-${node.fileId.toString()}`,
                        originalIndex: opt.index++,
                        pid: node.pid,
                        wid: node.wid,
                        fileId: node.fileId.toString(),
                        type: NodeLinkType.entity,
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
                name: "",
                group: 3,
                image: "sql.png",
                id: `entity-${node.fileId.toString()}`,
                originalIndex: opt.index++,
                pid: node.pid,
                wid: node.wid,
                fileId: node.fileId.toString(),
                type: NodeLinkType.entity,
            } as Node;
            opt.nodes.push(entityNode);
            let parentIdx = opt.nodes.findIndex((x) => x.name === node.name);;
            let targetIdx = opt.nodes.findIndex((x) => x.id === `entity-${node.fileId.toString()}`);;
            opt.links.push({ source: parentIdx, target: targetIdx, weight: 3, linkText: entityNode.name } as any);
        }

    }
    function extractJson(input: string) {
        const regex = /```json<br>([\s\S]*?)<br>```/;
        const match = input.match(regex);
        if (match && match[1]) {
            return match[1].replace(/<br>/g, "");
        } else {
            return input;
        }
    };
}


module.exports = dependencyRouter;