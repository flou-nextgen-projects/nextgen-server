import { Response, Request } from "express";
import { appService } from "../services/app-service";
import Mongoose from "mongoose";
import { FileMaster } from "../models";
import { PartialObject } from "lodash";
import { ObjectId } from "mongodb";

const getDocuments = function (request: Request, response: Response) {
    const filter: any = request.body;
    filter.fileId = filter.fileId instanceof ObjectId ? filter.fileId : new Mongoose.Types.ObjectId(filter.fileId);
    appService.statementMaster.getDocuments(filter).then(docs => {
        return response.status(200).json(docs).end();
    }).catch(err => {
        return response.status(500).json(err).end();
    });
};
const updateDocuments = function (request: Request, response: Response) {
    const filter: any = {
        pid: new Mongoose.Types.ObjectId("5e70c7160e2e7b7ef06859ca"),
        fileTypeId: {
            $in: [new Mongoose.Types.ObjectId("5e05db0b9d1f1a7ff45e2986"),
            new Mongoose.Types.ObjectId("5e05d6bb9d1f1a7ff45e2982"),
            new Mongoose.Types.ObjectId("5e05dad99d1f1a7ff45e2984"),
            new Mongoose.Types.ObjectId("5e05db0b9d1f1a7ff45e2986")]
        },
        Processed: true
    };
    const fieldsToUpdate: PartialObject<FileMaster> = { processed: false };
    appService.fileMaster.updateDocuments(filter, fieldsToUpdate).then((res) => {
        response.status(200).json(res).end();
    }).catch(err => {
        response.status(500).json(err).end();
    });
};
// TODO: there is function/route present in old repo for decisionMetrics and need to use that here...
// for time being, it's not been copied here...
export { getDocuments, updateDocuments };