import Express, { NextFunction, Request, Response, Router } from "express";
import { appService } from "../services/app-service";
import Mongoose from "mongoose";

const searchRouter: Router = Express.Router();

searchRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", async function (request: Request, response: Response) {
    try {
        const keywordString: any = request.body.keywords;
        const keywords = keywordString.split(',').map((k: string) => k.trim()).filter(Boolean);
        const regexArray = keywords.map((keyword: string) => new RegExp(keyword, 'i'));

        const searchCollection = (model: Mongoose.Collection, fields: Array<string>) => {
            // we need to change this to aggregation pipeline to get fileMaster details
            // prepare $match stage first and other pipeline stages as per requirement
            const matchStage = { $match: { $or: fields.map(field => ({ [field]: { $in: regexArray } })) } };
            // now prepare the $lookup stage to join with fileMaster collection
            const lookupStage = { $lookup: { from: "fileMaster", localField: "fid", foreignField: "_id", as: "fileDetails" } };
            // now prepare the $unwind stage to unwind the fileDetails array
            const unwindStage = { $unwind: { path: "$fileDetails", preserveNullAndEmptyArrays: true } };
            // combine all the stages into a pipeline array
            const pipeline = [matchStage, lookupStage, unwindStage];
            // now execute the aggregation pipeline and return the result
            return model.aggregate(pipeline).toArray();
            // return model.find({ $or: fields.map(field => ({ [field]: { $in: regexArray } })) }).toArray();
        };

        const [businessRules, sourceCode, summaries, userStories, entities] = await Promise.all([
            searchCollection(appService.mongooseConnection.collection("businessRules"), ['name', 'description', 'content']),
            searchCollection(appService.mongooseConnection.collection("fileContents"), ['original']),
            searchCollection(appService.mongooseConnection.collection("businessSummaries"), ["data"]),
            searchCollection(appService.mongooseConnection.collection("userStory"), ["data"]),
            searchCollection(appService.mongooseConnection.collection("entityMaster"), ['entityName'])
        ]);

        const fileIdSet = new Map();
        businessRules.forEach((item) => fileIdSet.set(item.fid, item.fileDetails?.fileName || 'Unknown'));
        sourceCode.forEach((item) => fileIdSet.set(item.fid, item.fileDetails?.fileName || 'Unknown'));
        summaries.forEach((item) => fileIdSet.set(item.fid, item.fileDetails?.fileName || 'Unknown'));
        userStories.forEach((item) => fileIdSet.set(item.fid, item.fileDetails?.fileName || 'Unknown'));
        entities.forEach((item) => fileIdSet.set(item.fid, item.fileDetails?.fileName || 'Unknown'));

        const table = Array.from(fileIdSet.entries()).map(([fileId, fileName]) => ({
            fileId, fileName,
            businessRules: businessRules.some((item) => item.fid === fileId) ? 'X' : '',
            sourceCodes: sourceCode.some((item) => item.fid === fileId) ? 'X' : '',
            summaries: summaries.some((item) => item.fid === fileId) ? 'X' : '',
            userStories: userStories.some((item) => item.fid === fileId) ? 'X' : '',
            entities: entities.some((item) => item.fid === fileId) ? 'X' : ''
        }));
        response.status(200).json(table).end();
    } catch (error) {
        console.error("Error in search:", error);
        response.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = searchRouter;