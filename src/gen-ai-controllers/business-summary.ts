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
        let fid = <string>request.query.fid;
        let member = await appService.memberReferences.getItem({ fid: new ObjectId(fid) });
        response.status(200).json(member).end();
    } catch (error) {
        response.status(500).send().end();
    }
}).get("/get-called-by", async (request: Request, response: Response) => {
    try {
        let fid = <string>request.query.fid;
        let calledBy: Array<any> = [];
        let members = await appService.memberReferences.getAllDocuments();
        for (const element of members) {
            if (element.callExternals.length == 0) continue;
            if (element.callExternals.filter((x: any) => x.fid.toString() === fid).length > 0) {
                calledBy.push(element);
            }
        }
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
        let entityList = await appService.entityMaster.getDocuments({ fid: new Mongoose.Types.ObjectId(fid) });
        let jsonData: Array<any> = [];
        let i: number = 0;
        if (entityList.length == 0) {
            response.status(200).json(jsonData).end();
        } else {
            let rootNode = { id: i++, parent: "#", text: "Entities", icon: "fa fa-folder", state: { selected: true } };
            jsonData.push(rootNode);
            for (const entity of entityList) {
                let entityNode = { id: i++, parent: 0, text: entity.entityName, icon: "fa fa-folder", state: { selected: false } };
                if (entity.attributes && entity.attributes.length > 0) {
                    for (const attribute of entity.attributes) {
                        let attributeNode = { id: i++, parent: entityNode.id, icon: "fa fa-file", text: ` ${attribute.attributeName}: ${attribute.description}`, state: { selected: false } };
                        jsonData.push(attributeNode);
                    }
                }
                jsonData.push(entityNode);
            }
            response.status(200).json(jsonData).end();
        }
    } catch (error) {
        response.status(500).send().end();
    }
}).get("/get-entities", function (request: Request, response: Response) {
    let fid = <string>request.query.fid;
    appService.entityMaster.getDocuments({ fid: new ObjectId(fid) }).then((result) => {
        response.status(200).json(result).end();
    }).catch((err) => {
        response.status(500).json(err).end();
    });
});

module.exports = bsRouter;