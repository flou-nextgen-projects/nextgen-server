import { Request, Response } from "express";
import { appService } from "../services/app-service";

const getAll = async function (request: Request, response: Response) {
    const fileMaster = await appService.fileMaster.getAllDocuments(30);
    response.status(200).json(fileMaster);
};

const getDocuments = function (request: Request, response: Response) {
    const filter: object = {
        FileTypeMasterId: request.body.FileTypeMasterId,
        FileNameWithoutExt: new RegExp(request.body.FileNameWithoutExt, 'i')
    };
    appService.fileMaster.getDocuments(filter).then((res) => {
        response.status(200).json(res);
    }).catch((error: Error) => {
        response.status(500).json(error);
    });
};

const aggregateAll = async function (request: Request, response: Response) {
    const pipeLine = [{
        $addFields: {
            FullName: { $concat: ["$FirstName", " ", "$LastName"] }
        }
    }];
    const userMasters = await appService.userMaster.aggregate({ body: pipeLine });
    response.status(200).json(userMasters).end();
};

export { getAll, getDocuments, aggregateAll }