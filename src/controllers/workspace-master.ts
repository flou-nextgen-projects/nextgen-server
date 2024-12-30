import Express, { NextFunction, Request, Response, Router } from "express";
import { appService } from "../services/app-service";
const workspaceRouter: Router = Express.Router();

workspaceRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/", async function (request: Request, response: Response) {
    const workspaces = await appService.workspaceMaster.aggregate();
    response.status(200).json(workspaces).end();
}).post("/", async function (request: Request, response: Response) {
    var wp = request.body;
    const workspace = await appService.workspaceMaster.addItem(wp);
    response.status(200).json(workspace).end();
});

module.exports = workspaceRouter;