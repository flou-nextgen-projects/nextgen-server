import { universeMainProcessUtils } from "../helpers";
import { Request, Response } from "express";
import { appService } from "../services/app-service";
import Mongoose from "mongoose";

const test = async function (request: Request, response: Response) {
    const id: string = <string>request.query.id;
    const projectMaster = await appService.projectMaster.findById(id);
    if (!projectMaster) response.end();
    try {
        var res = await universeMainProcessUtils.processUniVerseFilesStep("Jcl", ".jcl", projectMaster);
        response.status(200).json(res);
    } catch (error) {
        response.status(500).json(error);
    }
    finally {
        console.log("UniVerse file types processing step completed successfully!.");
    }
};

const aggregate = async function (request: Request, response: Response) {
    const docs = await appService.projectMaster.aggregate([{
        $match: {
            languageId: new Mongoose.Types.ObjectId("5ddbb84faeee6d3bf8aea9c2")
        }
    }]);
    response.status(200).json(docs).end();
};

export { test, aggregate };