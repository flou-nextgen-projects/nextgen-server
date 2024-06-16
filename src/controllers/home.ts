import Express, { Request, Response, Router, NextFunction } from "express";
// import newrelic from "newrelic";
const homeRouter: Router = Express.Router();

homeRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-status", function (request: Request, response: Response) {
    // newrelic.noticeError(new Error("custom message from yogeshs"), {expected: false, msg: "not sure why this error come"});
    response.status(200).json({ message: "API is up and running", status: "OK" });
}).get("/live", function (request: Request, response: Response) {
    // newrelic.noticeError(new Error("custom message from yogeshs"), {expected: false, msg: "not sure why this error come"});
    response.status(200).json({ message: "API is up and running", status: "OK" });
}).get("/ready", function (request: Request, response: Response) {
    // newrelic.noticeError(new Error("custom message from yogeshs"), {expected: false, msg: "not sure why this error come"});
    response.status(200).json({ message: "API is up and ready to receive requests", status: "OK" });
});
// Make the request and capture the response.

module.exports = homeRouter;