import Express, { Request, Response, Router, NextFunction } from "express";
const solutionRouter: Router = Express.Router();
import { appService } from "../services/app-service";
solutionRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async (request: Request, response: Response, next: NextFunction) => {
    let solutions = await appService.mongooseConnection.collection("workspaceMaster").aggregate([
        { $lookup: { from: "projectMaster", localField: "_id", foreignField: "wid", as: "projects" } },
        /* { $lookup: { from: "languageMaster", localField: "lid", foreignField: "_id", as: "languageMaster" } },
        { $unwind: { path: "$languageMaster", includeArrayIndex: 'true', preserveNullAndEmptyArrays: true } }, */
        { $sort: { projects: -1 } }
    ]).toArray();
    response.status(200).json(solutions).end();
});

module.exports = solutionRouter;