import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { Link, Node, _createNode } from "../models";
import { ObjectId } from "mongodb";
import Mongoose, { PipelineStage } from "mongoose";
import { forEach } from "lodash";

const brRouter: Router = Express.Router();
brRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessRules');
    let businessSummary = request.body;
    collection.insertOne(businessSummary).then((reference) => {
        response.status(200).json((reference)).end();
    }).catch((err) => {
        response.status(500).json({ err }).end();
    });
}).get("/", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessRules');
    let $filter = JSON.parse(<string>request.query.$filter);
    let filter = Object.assign({}, $filter);
    let summary = await collection.findOne(filter);
    if (!summary) {
        return response.status(404).json({ message: 'There is no existing business rules generated for this document. Please generate it.' }).end();
    }
    response.status(200).json((summary)).end();
}).get("/all", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessRules');
    let $filter = JSON.parse(<string>request.query.$filter);
    let filter = Object.assign({}, $filter);
    let summary = await collection.find(filter).toArray();
    if (!summary) {
        return response.status(404).json({ message: 'There is no existing data generated for this document. Please generate it.' }).end();
    }
    response.status(200).json((summary)).end();
}).post("/update-by-id/:id", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessRules');
    let data = await collection.findOneAndUpdate(
        { _id: new ObjectId(request.params.id) },
        { $set: request.body },
        { returnDocument: 'after' }
    );
    if (!data) {
        return response.status(404).json({ message: 'business Summary Update API Error' }).end();
    }
    response.status(200).json(({ message: `${data.type} Update Successfully`, data })).end();
}).get("/get-business-rule/:fid/:promptId", (request: Request, response: Response) => {
    const { fid, promptId } = request.params;
    appService.mongooseConnection.collection("businessRules").findOne({ fid: Mongoose.Types.ObjectId.createFromHexString(fid), promptId: parseInt(promptId) })
        .then((res) => {
            response.status(200).json(res).end();
        }).catch((err) => {
            response.status(500).json(err).end();
        })
}).get("/check-business-rule/:fid", (request: Request, response: Response) => {
    const { fid } = request.params;
    appService.mongooseConnection.collection("businessRules").find({ fid: Mongoose.Types.ObjectId.createFromHexString(fid) }).toArray()
        .then((res) => {
            response.status(200).json(res).end();
        }).catch((err) => {
            response.status(500).json(err).end();
        });
}).get("/business-rule-diagram/:fid/:promptId", async (request: Request, response: Response) => {
    try {
        const { fid, promptId } = request.params;
        // const promptid = parseInt(promptId);
        let pipeLine: Array<PipelineStage> = [
            { $match: { fid: Mongoose.Types.ObjectId.createFromHexString(fid) } },
            { $lookup: { from: "methodDetails", localField: "fid", foreignField: "_id", as: "methodDetails" } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$methoDetails" } },
            { $lookup: { from: 'fileMaster', localField: 'methodDetails.fid', foreignField: '_id', as: 'fileMaster' } },
            { $unwind: { preserveNullAndEmptyArrays: true, path: "$fileMaster" } }
        ];
        const businessRules = await appService.mongooseConnection.collection("businessRules").aggregate(pipeLine);

        const results = await businessRules.toArray();

        if (!results.length) {
            return response.status(404).json({ error: "Data not found" }).end();
        }
        const res = results[0];
        // const res = await appService.mongooseConnection.collection("businessRules").findOne({ fid: Mongoose.Types.ObjectId.createFromHexString(fid) /*, promptId: promptid*/ });
        if (!res) { return response.status(404).json({ error: "Data not found" }).end(); }
        var fileName = res.fileMaster.fileNameWithoutExt;
        const links: Array<Link> = [];
        let nodes: Array<Node> = [];
        const startNode: Node = {
            name: "Start",
            group: 1,
            image: "RoundRect",
            id: "0".toString(),
            originalIndex: 0,
            pid: res.pid.toString(),
            wid: res._id,
            fileId: res.fid.toString(),
            info: { root: "", dir: "", base: "", ext: "", name: "" },
            fileType: "roundrectangle",
            type: 1,
            filePath: "Start",
            color: "#ffcc00",
        };
        nodes.push(startNode);
        const finalData = await createIndividualNodes(res.rawData, startNode);
        nodes.push(...finalData.nodes);
        links.push(...finalData.links);
        var link: any = { source: startNode.id, target: finalData.nodes[0].id, weight: 3, linkText: "abc" };
        links.push(link);
        const allLinks = await createLinks(nodes, links);
        let finalNodes = removeParaCalled(nodes);
        var finalLinks = removeLinks(links, finalNodes);
        const lastNode = finalNodes.length > 0 ? finalNodes[finalNodes.length - 1] : null;
        if (lastNode) {
            let index = lastNode.originalIndex + 1;
            const endNode: Node = {
                name: "End",
                group: lastNode.group + 1,
                image: "RoundRect",
                id: index.toString(),
                originalIndex: index,
                pid: res.pid.toString(),
                wid: res._id,
                fileId: res.fid.toString(),
                info: { root: "", dir: "", base: "", ext: "", name: "" },
                fileType: "roundrectangle",
                type: 1,
                filePath: "End",
                color: "#ffcc00",
            };
            finalNodes.push(endNode);
            var link: any = { source: lastNode.id, target: endNode.id, weight: 3, linkText: "abc" };
            finalLinks.push(link);
        }
        // let finalLinks = removeLinks(links, finalNodes);
        response.status(200).json({ nodes: finalNodes, links: finalLinks, fileName: fileName }).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
});


const createIndividualNodes = async (data: any[], lastNode: any): Promise<{ nodes: Node[], links: Link[] }> => {
    const nodes: Node[] = [];
    const links: Link[] = [];
    try {
        const categoryColors: Record<string, string> = { validation: "#cc99ff", controlflow: "#99ccff", calculations: "#ffff99", calculation: "#ffff99", businesslogic: "#ffcc99", initialization: "#c0c0c0" };
        const categoryShape: Record<string, string> = { validation: "RoundRect", controlflow: "Decision2", calculations: "RoundRect", calculation: "RoundRect", businesslogic: "RoundRect", initialization: "RoundRect" };
        var group = 0;
        var originalIndex = 0;
        if (Array.isArray(data)) {
            for (const d of data) {
                const ruleSet: string[] = [];
                var grp = group++;
                var modifiedLines = appendLines(d.data);
                let lines = d.data.split("\n");
                if (modifiedLines) {
                    lines = modifiedLines.split("\n");
                }
                var methodName = "";
                for (const l of d.method) {
                    if (l.trim().startsWith("*")) continue;
                    methodName = l;
                    break;
                }
                for (const line of lines) {
                    if (line === "") continue;
                    var nodeId = originalIndex + 1;
                    let l = line.replace(/^[-+]\s*/, '');
                    const matchRule = l.match(/^Ruleset/);
                    if (matchRule) { ruleSet.push(l); continue; }
                    const match = l.match(/\[(.*?)\]/);
                    if (match) {
                        const value = match[1];
                        const normalizedCategory = value.replace(/\s+/g, "").toLowerCase();
                        let color = "#c0c0c0"; // default color
                        for (const key in categoryColors) {
                            if (normalizedCategory.includes(key)) {
                                color = categoryColors[key];
                                break;
                            }
                        }
                        let shape = "RoundRect"; // default shape
                        for (const key in categoryShape) {
                            if (normalizedCategory.includes(key)) {
                                shape = categoryShape[key];
                                break;
                            }
                        }
                        let nodeValidation: Node = {
                            name: l,
                            group: grp,
                            id: nodeId.toString(),
                            originalIndex: ++originalIndex,
                            pid: new ObjectId().toString(),
                            wid: new ObjectId().toString(), fileId: new ObjectId().toString(),
                            info: { root: "", dir: "", base: "", ext: "", name: "" }, // correct structure
                            fileType: methodName,
                            type: 1,
                            filePath: ruleSet[0],
                            color: color,
                            image: shape
                        }
                        const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
                        if (lastNode) {
                            var link: any = { source: lastNode.id, target: nodeValidation.id, weight: 3, linkText: "abc" };
                            links.push(link);
                        }
                        nodes.push(nodeValidation);
                    } else {
                        let nodeValidation: Node = {
                            name: l,
                            group: grp,
                            id: nodeId.toString(),
                            originalIndex: ++originalIndex,
                            pid: new ObjectId().toString(),
                            wid: new ObjectId().toString(), fileId: new ObjectId().toString(),
                            info: { root: "", dir: "", base: "", ext: "", name: "" }, // correct structure
                            fileType: methodName,
                            type: 1,
                            filePath: ruleSet[0],
                            color: "#c0c0c0",
                            image: "RoundRect"
                        }
                        const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
                        if (lastNode) {
                            var link: any = { source: lastNode.id, target: nodeValidation.id, weight: 3, linkText: "abc" };
                            links.push(link);
                        }
                        nodes.push(nodeValidation);
                    }
                }
            }
        }
        else {
            const newData: string = data;
            var modifiedLines = appendLines(newData);
            let lines = newData.split("\n");
            if (modifiedLines) {
                lines = modifiedLines.split("\n");
            }
            var methodName = "";
            const ruleSet: string[] = [];
            for (const line of lines) {
                if (line === "") continue;
                var nodeId = originalIndex + 1;
                let l = line.replace(/^[-+]\s*/, '');
                const matchRule = l.match(/^Ruleset/);
                if (matchRule) { ruleSet.push(l); continue; }
                const match = l.match(/\[(.*?)\]/);
                if (match) {
                    const value = match[1];
                    const normalizedCategory = value.replace(/\s+/g, "").toLowerCase();
                    let color = "#c0c0c0"; // default color
                    for (const key in categoryColors) {
                        if (normalizedCategory.includes(key)) {
                            color = categoryColors[key];
                            break;
                        }
                    }
                    let shape = "RoundRect"; // default shape
                    for (const key in categoryShape) {
                        if (normalizedCategory.includes(key)) {
                            shape = categoryShape[key];
                            break;
                        }
                    }
                    let nodeValidation: Node = {
                        name: l,
                        group: grp,
                        id: nodeId.toString(),
                        originalIndex: ++originalIndex,
                        pid: new ObjectId().toString(),
                        wid: new ObjectId().toString(), fileId: new ObjectId().toString(),
                        info: { root: "", dir: "", base: "", ext: "", name: "" }, // correct structure
                        fileType: methodName,
                        type: 1,
                        filePath: ruleSet[0],
                        color: color,
                        image: shape
                    }
                    const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
                    if (lastNode) {
                        var link: any = { source: lastNode.id, target: nodeValidation.id, weight: 3, linkText: "abc" };
                        links.push(link);
                    }
                    nodes.push(nodeValidation);
                } else {
                    let nodeValidation: Node = {
                        name: l,
                        group: grp,
                        id: nodeId.toString(),
                        originalIndex: ++originalIndex,
                        pid: new ObjectId().toString(),
                        wid: new ObjectId().toString(), fileId: new ObjectId().toString(),
                        info: { root: "", dir: "", base: "", ext: "", name: "" }, // correct structure
                        fileType: methodName,
                        type: 1,
                        filePath: ruleSet[0],
                        color: "#c0c0c0",
                        image: "RoundRect"
                    }
                    const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
                    if (lastNode) {
                        var link: any = { source: lastNode.id, target: nodeValidation.id, weight: 3, linkText: "abc" };
                        links.push(link);
                    }
                    nodes.push(nodeValidation);
                }
            }
        }
        return { nodes, links };
    }
    catch (error) {
        console.log(error);
    }
};
const createLinks = async (node: any[], links: any[]): Promise<Node[]> => {
    const nodes: Node[] = [];
    try {
        const paraCallRegex = /\(?\s*paraCalled\s*:\s*([^)]+)\)?/i;
        for (const d of node) {
            var nodeName = d.name.split("\n");
            for (const l of nodeName) {
                let line = l.trim();
                const match = paraCallRegex.exec(line);
                const paraCalledList: string[] = match ? match[1].split(',').map((s: string) => s.trim()) : [];
                if (paraCalledList.length > 0) {
                    for (const paraCalled of paraCalledList) {
                        if (paraCalled && paraCalled.toString().trim().toUpperCase() !== "NONE") {
                            var findNode = node.find(d => d.filePath.includes(paraCalled) || d.fileType === paraCalled);
                            if (findNode) {
                                var exist = links.find(d => d.source === d.id && d.target === findNode.id);
                                if (!exist) {
                                    var link: any = { source: d.id, target: findNode.id, weight: 3, linkText: "abc" };
                                    links.push(link);
                                }
                            }

                        }
                    }
                }
            }
        }
        return nodes;
    }
    catch (error) {
        console.log(error);
    }
};

const removeParaCalled = (node: Node[]): Node[] => {
    var finalNodes: Node[] = [];
    for (const d of node) {
        d.name = d.name
            .replace(/\(?\s*ParaCalled\s*:\s*[^)]+\)?/gi, '')
            .replace(/\*/g, '')
            .replace(/Called Paragraphs Inline:/gi, '')
            .trim();
        // finalNodes.push(d);
        if (d.name) finalNodes.push(d);
    }

    return finalNodes;
};
const removeLinks = (links: Link[], nodes: Node[]): Link[] => {
    var finalLinks: Link[] = [];
    for (const link of links) {
        const sourceExists = nodes.some(d => d.id.toString() === link.source.toString());
        const targetExists = nodes.some(d => d.id.toString() === link.target.toString());
        if (sourceExists && targetExists) {
            finalLinks.push(link);
        }
    }
    return finalLinks;
};
const appendLines = (data: any): any => {
    try {
        const lines: string[] = data.split('\n');
        const mergedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (i === 0) {
                mergedLines.push(line);
                continue;
            }
            if (!line) continue;
            const match = line.match(/\[(.*?)\]/);
            if (match) {
                mergedLines.push(`${line}`);
            }
            if (!match) {
                mergedLines[mergedLines.length - 1] += ' ' + line;
                // i++;
            } else if (i === lines.length - 1 && mergedLines.length > 0) {
                // Last line, doesn't start with '[', append to previous
                mergedLines[mergedLines.length - 1] += ' ' + line;
                i++;
            }
        }
        return mergedLines.join('\n');
    }
    catch (error) {
        return [];
    }
}
module.exports = brRouter;