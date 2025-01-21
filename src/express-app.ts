import express, { NextFunction, Request, Response } from "express";
import Cors from 'cors';
import { json, urlencoded } from 'body-parser';
var morgan = require('morgan');
// import { clientAuth } from './middleware/client-auth';
import http2Express from 'http2-express-bridge';
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
import { join, resolve } from "path";
import chalk from "chalk";
import { AppError } from './common/app-error';


const app = http2Express(express);
app.use(json({ limit: '60mb' }));
app.use(urlencoded({ limit: '60mb', extended: true }));
app.use(Cors());
app.use(Cors({
    allowedHeaders: ["x-token", "Authorization"]
}));

export default app;

export const setAppRoutes = function (app: express.Application) {
    app.get('/', function (request: Request, response: Response) {
        response.status(200).json({ msg: 'Server app is up and running!.' }).end();
    });
    
    app.use((err: any, req: Request, res: Response, next: Function) => {
        if (res.headersSent) return next();
        res.status(err.httpStatusCode || 500).render('UnknownError');
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
        console.log("---=================================================================---");
        console.log(chalk.green(`---==== ${req.url} ====---`));
        next();
    });

    let authRouter = require("./middleware/client-auth");
    app.use("/backend/main/api/*", authRouter);

    var combined = morgan("combined");
    app.use(combined);

    app.get("/user/:id(\\d+)", (request: Request, response: Response) => {
        response.status(200).json({ msg: "OK", data: { id: request.params } }).end();
    });
    const router = require("./routes/default.routes");
    app.use(/backend\/main\/api\/defaults\/.*/g, router);    
    var homeRouter = require('./controllers/home');
    var userRouter = require("./controllers/user-master");
    var loginRouter = require("./controllers/user-login");
    var roleMasterRouter = require("./controllers/role-master");
    var pmRouter = require("./controllers/project-master");
    var langRouter = require("./controllers/language-master");
    var ftmRouter = require("./controllers/file-type-master");
    var bcRouter = require("./controllers/base-command-master");
    var bcRefRouter = require("./controllers/base-command-reference");
    var workspaceRouter = require("./controllers/workspace-master");
    var topicRouter = require("./kafka-services/kafka-topics");
    var solutionRouter = require("./controllers/solutions");
    var docRouter = require("./controllers/doc-master");
    var statementRouter = require('./controllers/statement-reference');
    var aiRouter = require('./controllers/ai-chats');
    var dashBoardRouter = require('./controllers/dashboard');
    var fmRouter = require('./controllers/file-master');
    var functionalFlowRouter = require('./controllers/functional-flow');
    var dependencyRouter = require('./controllers/dependencies-diagram');
    require("./kafka-services/kafka-consumer"); // no need to have routes
    app.use("/check/api/home", homeRouter);
    app.use("/backend/api/user-login", loginRouter);
    app.use("/backend/main/api/user-master", userRouter);
    app.use("/backend/main/api/role-master", roleMasterRouter);
    app.use("/backend/main/api/language-master", langRouter);
    app.use("/backend/main/api/workspace-master", workspaceRouter);
    app.use("/backend/main/api/project-master", pmRouter);
    app.use("/backend/main/api/file-type-master", ftmRouter);
    app.use("/backend/main/api/base-command-master", bcRouter);
    app.use("/backend/main/api/base-command-reference", bcRefRouter);
    app.use("/backend/main/api/topics", topicRouter);
    app.use("/backend/main/api/solution", solutionRouter);
    app.use("/backend/main/api/doc-master", docRouter);
    app.use("/backend/main/api/statement-reference", statementRouter);
    app.use("/gen-ai/chat", aiRouter);
    app.use("/backend/main/api/dashboard", dashBoardRouter);
    app.use("/backend/main/api/file-master", fmRouter);
    app.use("/backend/main/api/functional-flow", functionalFlowRouter);
    app.use("/backend/main/api/dependencies", dependencyRouter);
    // db status router
    var dbStatusRouter = require("./config/check-status");
    app.use("/backend/db", dbStatusRouter);
    // job processing routers
    var cobolProcessRouter = require("./jobs/process-cobol-project");
    var startProcessRouter = require("./jobs/start-processing");
    app.use("/backend/jobs/api/cobol-process", cobolProcessRouter);
    app.use("/backend/jobs/api/csharp-process", startProcessRouter);

    // GenAI routes
    // all routes are added into gen-ai.routes file under routes folder

    let genAiRoutes = require("./routes/gen-ai.routes");
    app.use("/backend/main/api", genAiRoutes);

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        if (err instanceof AppError) {
            res.status(err.statusCode).json({
                status: 'error',
                message: err.message,
                additionalInfo: err.additionalInfo
            }).end();
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Internal Server Error'
            }).end();
        }
    });
    const swaggerApi = resolve(join(__dirname, "swagger"));
    const options = {
        definition: {
            openapi: "3.0.1",
            info: {
                title: "NextGen Backend Application APIs",
                version: "1.0.0"
            },
            basePath: "/",
            servers: [{ url: "/" }],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: 'bearer',
                        bearerFormat: "JWT"
                    }
                }
            }
        },
        apis: [`${swaggerApi}/*.js`]
    };
    const specs = swaggerJsdoc(options);
    app.use('/backend/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { customCss: ".swagger-ui .btn {margin-right: 4px;} .swagger-ui .auth-container input[type=password], .swagger-ui .auth-container input[type=text] {min-width: 100%;} .swagger-ui .scheme-container .schemes .auth-wrapper .authorize {margin-right: 4px;} .swagger-ui .auth-btn-wrapper {justify-content: left;} .topbar {display: none !important} .swagger-ui .info {margin: 10px 0 10px 0} .swagger-ui .info hgroup.main {margin: 0px 0 10px;} .swagger-ui .scheme-container {margin: 0; padding: 15px 0;} .swagger-ui .info .title {text-align: center;}" }));
}