import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { ObjectId } from "mongodb";
const dependacyRouter: Router = Express.Router();
dependacyRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async (request: Request, response: Response) => {
    try {
        let fid = <string>request.query.fid;
        const fileMaster = await appService.fileMaster.getDocuments({ _id: new ObjectId(fid) });
        response.status(200).json(fileMaster).end();
    } catch (error) {
        return response.status(500).json(error).end();
    }
});
module.exports = dependacyRouter;