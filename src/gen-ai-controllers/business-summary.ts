import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { ObjectId } from "mongodb";
import Mongoose from "mongoose";
import extractDataEntities from "../helpers/common/entity-master-helper";

const bsRouter: Router = Express.Router();
bsRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let businessSummary = request.body;
    collection.insertOne(businessSummary).then((reference) => {
        response.status(200).json((reference)).end();
    }).catch((err) => {
        response.status(500).json({ err }).end();
    });
}).get("/", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let $filter = JSON.parse(<string>request.query.$filter);
    let filter = Object.assign({}, $filter);
    let summary = await collection.findOne(filter);
    if (!summary) {
        return response.status(404).json({ message: 'There is no existing summary generated for this document. Please generate it.' }).end();
    }
    response.status(200).json((summary)).end();
}).get("/all", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let $filter = JSON.parse(<string>request.query.$filter);
    let filter = Object.assign({}, $filter);
    let summary = await collection.find(filter).toArray();
    if (!summary) {
        return response.status(404).json({ message: 'There is no existing data generated for this document. Please generate it.' }).end();
    }
    response.status(200).json((summary)).end();
}).post("/update-by-id/:id", async function (request: Request, response: Response) {
    var collection = appService.mongooseConnection.collection('businessSummaries');
    let data = await collection.findOneAndUpdate(
        { _id: new ObjectId(request.params.id) },
        { $set: request.body },
        { returnDocument: 'after' }
    );
    if (!data) {
        return response.status(404).json({ message: 'business Summary Update API Error' }).end();
    }
    response.status(200).json(({ message: `${data.type} Update Successfully`, data })).end();
}).get("/get-call-externals", async (request: Request, response: Response) => {
    try {
        let methodId = <string>request.query.methodId;
        let methodDetails = await appService.methodDetails.getItem({ _id: new ObjectId(methodId) });
        response.status(200).json(methodDetails).end();
    } catch (error) {
        response.status(500).send().end();
    }
}).get("/get-called-by", async (request: Request, response: Response) => {
    try {
        let methodId = <string>request.query.methodId;
        let calledBy = await appService.methodDetails.getDocuments({ "callExternals.methodId": new ObjectId(methodId) });
        response.status(200).json(calledBy).end();
    } catch (error) {
        response.status(500).send().end();
    }
}).post("/extract-data-entities", async (request: Request, response: Response) => {
    try {
        var reqBody = request.body;
        let result = await extractDataEntities(reqBody.data, reqBody.pid, reqBody.fid)
        /*let variables: any = JSON.parse(reqBody.data);
        let entities = variables.entities;
        let pid = reqBody.pid;
        let fid = reqBody.fid;
        for (const key in entities) {
            if (Object.prototype.hasOwnProperty.call(entities, key)) {
                const element = entities[key];
                const entityName: string = key;
                const document: any = {
                    entityName: entityName,
                    fid: Mongoose.Types.ObjectId.createFromHexString(fid),
                    pid: Mongoose.Types.ObjectId.createFromHexString(pid),
                    attributes: element.attributes
                };
                await appService.entityMaster.addItem(document);
            }
        }*/
        if (result.success) {
            response.status(200).json("Data saved successfully.").end();
        } else {
            response.status(500).json(result.error).end();
        }
    } catch (error) {
        response.status(500).json(error).end();
    }
}).get("/get-data-element-tree/:fid", async (request: Request, response: Response) => {
    try {
        let fid = request.params.fid;
        let result = await appService.entityMaster.getItem({ fid: new Mongoose.Types.ObjectId(fid) });
        if (result && result.entityName == "None") { // this is mainly done for cobol programs as there are entities extracted from assessment utility for some programs 
            response.status(200).json([{ id: 1, parent: "#", text: result.entityName, icon: "fa fa-folder", state: { selected: true } }]).end();
        } else {
            let entityList: Array<any> = await appService.entityAttributes.aggregate([
                { "$match": { fid: new Mongoose.Types.ObjectId(fid) } },
                { "$group": { "_id": "$entityName", "attributes": { "$addToSet": "$$ROOT" } } },
                { "$project": { entityName: "$_id", attributes: 1, _id: 0 } }
            ]);
            // let entityList = await appService.entityMaster.getDocuments({ fid: new Mongoose.Types.ObjectId(fid) });
            let jsonData: Array<any> = [];
            let i: number = 0;
            if (entityList.length == 0) {
                response.status(200).json(jsonData).end();
            } else {
                let rootNode = { id: i++, parent: "#", text: "Entities", icon: "fa fa-folder", state: { selected: true } };
                jsonData.push(rootNode);
                for (const entity of entityList) {
                    let entityNode = { id: i++, parent: 0, text: entity.entityName, icon: "fa fa-folder", state: { selected: false } };
                    //if (entity.attributes && entity.attributes.length > 0) {
                    for (const attribute of entity.attributes) {
                        // If 'attributeName' exists, return it; otherwise, use the first key
                        // let attrName = attribute.hasOwnProperty("attributeName") ? attribute["attributeName"] : Object.keys(attribute)[0] || "";
                        // let description = attribute.hasOwnProperty("description") ? attribute["description"] : Object.keys(attribute)[0] || "";
                        let attrName = attribute.attributeName;
                        let attributeNode = { id: i++, parent: entityNode.id, icon: "fa fa-file", text: ` ${attrName}`, state: { selected: false } };
                        jsonData.push(attributeNode);
                    }
                    // }
                    jsonData.push(entityNode);
                }
                response.status(200).json(jsonData).end();
            }
        }
    } catch (error) {
        response.status(500).send().end();
    }
}).get("/get-entities", async (request: Request, response: Response) => {
    try {
        let fid = <string>request.query.fid;
        let result = await appService.entityAttributes.aggregate([
            { "$match": { fid: new Mongoose.Types.ObjectId(fid) } },
            { "$group": { "_id": "$entityName", "attributes": { "$addToSet": "$$ROOT" } } },
            { "$project": { entityName: "$_id", attributes: 1, _id: 0 } }
        ]);
        if (result.length > 0) {
            response.status(200).json(result).end();
        } else {
            let result = await appService.mongooseConnection.collection("businessSummaries").findOne({ fid: new ObjectId(fid), promptId: 1001 });
            response.status(200).json(result).end()
        }
    } catch (error) {
        response.status(500).json(error).end();
    }
}).get("/delete-gen-ai-data/:fid/:promptId", async (request: Request, response: Response) => {
    // this api use for deleting data generated from genAI from businessSummary collection for variable & data elements,pseudo & business summary
    const { fid, promptId } = request.params;
    const promptid = parseInt(promptId);
    if (promptId === "1001") {
        let result = await appService.entityMaster.removeAll({ fid: Mongoose.Types.ObjectId.createFromHexString(fid) });
        let attributes = await appService.entityAttributes.removeAll({ fid: Mongoose.Types.ObjectId.createFromHexString(fid) });
        appService.mongooseConnection.collection("businessSummaries").deleteOne({ fid: Mongoose.Types.ObjectId.createFromHexString(fid), promptId: promptid })
            .then((res) => {
                response.status(200).json({ msg: "Record deleted successfully." }).end();
            }).catch((err) => {
                response.status(500).json(err).end();
            });
    } else {
        appService.mongooseConnection.collection("businessSummaries").deleteOne({ fid: Mongoose.Types.ObjectId.createFromHexString(fid), promptId: promptid })
            .then((res) => {
                response.status(200).json({ msg: "Record deleted successfully." }).end();
            }).catch((err) => {
                response.status(500).json(err).end();
            });
    }

}).get("/get-business-summary", async (request: Request, response: Response) => {
    try {
        let fid = <string>request.query.fid;
        let promptId = Number(request.query.promptId);
        var collection = appService.mongooseConnection.collection('businessSummaries');
        let businessSummary = await collection.findOne({ fid: new ObjectId(fid), promptId: promptId });
        response.status(200).json(businessSummary).end();
    } catch (error) {
        response.status(500).send().end();
    }
}).get("/delete-business-rules/:fid/:promptId", (request: Request, response: Response) => {
    const { fid, promptId } = request.params;
    const promptid = parseInt(promptId);
    appService.mongooseConnection.collection("businessRules").deleteOne({ fid: Mongoose.Types.ObjectId.createFromHexString(fid), promptId: promptid })
        .then((res) => {
            response.status(200).json({ msg: "Record deleted successfully." }).end();
        }).catch((err) => {
            response.status(500).json(err).end();
        })
}).get("/get-input-output-dataset/:fid", (request: Request, response: Response) => {
    const { fid } = request.params;
    appService.mongooseConnection.collection("businessSummaries").aggregate([
        { $match: { promptId: { $in: [1031, 1032] } } },
        { $match: { fid: new ObjectId(fid) } }]).toArray()
        .then((res) => {
            response.status(200).json(res).end();
        }).catch((err) => {
            response.status(500).json(err).end();
        });
});

module.exports = bsRouter;