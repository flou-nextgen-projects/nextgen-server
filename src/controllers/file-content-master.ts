import { appService } from "../services/app-service";
import { Request, Response } from "express";
import { ObjectId } from "mongodb";

const getDoc = function (request: Request, response: Response) {
    appService.fileContentMaster.getItem({ FileId: new ObjectId(<string>request.query.fileId) }).then((res) => {
        response.status(200).json(res).end();
    }).catch((err: Error) => {
        response.status(500).json(err).end();
    });
};

export { getDoc };