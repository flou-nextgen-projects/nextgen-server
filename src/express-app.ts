import express, { NextFunction, Request, Response } from "express";
import Cors from 'cors';
import { json, urlencoded } from 'body-parser';
var morgan = require('morgan');
import { WinstonLogger } from "nextgen-utilities";
import http2Express from 'http2-express-bridge';
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
import { join, resolve } from "path";
import chalk from "chalk";
import { AppError } from './common/app-error';
import { Db, MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { UserMaster } from "./models";
// import { appService } from "./services/app-service";

const winstonLogger: WinstonLogger = new WinstonLogger(__filename);
const app = http2Express(express);
app.use(json({ limit: '60mb' }));
app.use(urlencoded({ limit: '60mb', extended: true }));
app.use(Cors());
app.use(Cors({
    allowedHeaders: ["x-token", "Authorization"]
}));

app.post("/backend/api/app-db", async (request: Request, response: Response) => {
    let body = request.body;
    // prepare mongodb connection URL
    // const mongoDbUrl = `mongodb://${body.userName}:${body.mongoPass}@${body.host}:${body.port}/?authSource=admin`;
    const mongoDbUrl = `mongodb://${body.host}:${body.port}`;
    const mongoClient: MongoClient = new MongoClient(mongoDbUrl, {
        socketTimeoutMS: 300000,
        maxIdleTimeMS: 300000
    });
    let client = await mongoClient.connect();
    const session = client.startSession();
    // check if database is already initialized
    // now switch to application database
    try {
        await session.withTransaction(async () => {
            const dbConnection = client.db("admin");
            // we need to create mongodb user under admin database
            // check if user already exists
            const user = await dbConnection.collection("system.users").findOne({ user: body.userName });
            if (!user) {
                await dbConnection.command({ createUser: body.userName, pwd: body.mongoPass, roles: ["root"] });
            }
            // now switch to application database
            const appDb = client.db(body.dbName);
            let dbStatus = await appDb.collection("dbStatus").findOne();
            if (!dbStatus) {
                let collection = await appDb.createCollection("dbStatus");
                await collection.insertOne({ configured: false, enabled: false });
                dbStatus = await appDb.collection("dbStatus").findOne();
            }
            // check if field configured value is false
            if (dbStatus.configured) return;
            try {
                // Start init process of database configuration
                await _initDatabaseConfiguration(dbStatus, appDb);
                // update .env file with new connection string
                const envFilePath = resolve(join(__dirname, "../", ".env"));
                const envFileContent = readFileSync(envFilePath, "utf-8");
                let updatedEnvFileContent = envFileContent.replace(/NG_MONGO_HOST=.*/g, `NG_MONGO_HOST=${body.host}`);
                updatedEnvFileContent = updatedEnvFileContent.replace(/NG_MONGO_PORT=.*/g, `NG_MONGO_PORT=${body.port}`);
                updatedEnvFileContent = updatedEnvFileContent.replace(/NG_MONGO_DB=.*/g, `NG_MONGO_DB=${body.dbName}`);
                updatedEnvFileContent = updatedEnvFileContent.replace(/NG_MONGO_USER=.*/g, `NG_MONGO_USER=${body.userName}`);
                updatedEnvFileContent = updatedEnvFileContent.replace(/NG_MONGO_PASS=.*/g, `NG_MONGO_PASS=${body.mongoPass}`);
                const fs = require('fs');
                fs.writeFileSync(envFilePath, updatedEnvFileContent);
                winstonLogger.info("Database initialization process completed successfully", { name: "Database Initialization", code: "DB_INIT_SUCCESS" });
                // we need to write the app-db.json file with the new parameters
                const appDbFilePath = resolve(join(__dirname, "../", "app-db.json"));
                const appDbFileContent = readFileSync(appDbFilePath, "utf-8");
                let updatedAppDbFileContent = appDbFileContent.replace(/NG_MONGO_HOST=.*/g, `NG_MONGO_HOST=${body.host}`);
                updatedAppDbFileContent = updatedAppDbFileContent.replace(/NG_MONGO_PORT=.*/g, `NG_MONGO_PORT=${body.port}`);
                updatedAppDbFileContent = updatedAppDbFileContent.replace(/NG_MONGO_DB=.*/g, `NG_MONGO_DB=${body.dbName}`);
                updatedAppDbFileContent = updatedAppDbFileContent.replace(/NG_MONGO_USER=.*/g, `NG_MONGO_USER=${body.userName}`);
                updatedAppDbFileContent = updatedAppDbFileContent.replace(/NG_MONGO_PASS=.*/g, `NG_MONGO_PASS=${body.mongoPass}`);
                fs.writeFileSync(appDbFilePath, updatedAppDbFileContent);
                winstonLogger.info("app-db.json file updated successfully", { name: "Database Initialization", code: "DB_INIT_SUCCESS" });
            }
            catch (error) {
                winstonLogger.error(error, { name: "Database initialization error", code: "DB_INIT_ERROR" });
                // rollback the transaction
                await session.abortTransaction();
                // throw an error
                throw new AppError("Database initialization error", 500, { additionalInfo: { ...error } });
            }
            finally {
                // close the connection
                await client.close();
            }
        });
    } catch (error) {
        winstonLogger.error(error, { name: "Error in database initialization", code: "DB_INIT_ERROR" });
        response.status(500).json({ error: 'Internal server error' }).end();
    } finally {
        await session.endSession();
    }
    // restart the server
    // process.exit(0);  
    response.status(200).json({ msg: "OK", data: { id: request.params } }).end();
});

export default app;

export const setAppRoutes = function (app: express.Application) {
    app.get('/', function (_: Request, response: Response) {
        response.status(200).json({ msg: 'Server app is up and running!.' }).end();
    });

    app.use((err: any, request: Request, response: Response, next: Function) => {
        if (response.headersSent) return next();
        response.status(err.httpStatusCode || 500).render('UnKnownError');
    });

    app.use((request: Request, response: Response, next: NextFunction) => {
        console.log("---=================================================================---");
        console.log(chalk.green(`---==== ${request.url} ====---`));
        request.on("error", (err: Error) => {
            winstonLogger.error(err, { name: `Error occurred in endpoint: ${request.url}`, code: "REQUEST_ERROR" });
        });
        response.on("error", (err: Error) => {
            winstonLogger.error(err, { name: `Error occurred in endpoint: ${request.url}`, code: "RESPONSE_ERROR" });
        });
        next();
    });

    let authRouter = require("./middleware/client-auth");
    app.use("/backend/main/api/*", authRouter);
    let superAuthRouter = require("./middleware/super-auth");
    app.use("/backend/super/admin/*", superAuthRouter);

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
    app.use("/backend/api/home", homeRouter);
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
    app.use("/backend/super/admin/db", dbStatusRouter);
    // job processing routers
    /* 
    var cobolProcessRouter = require("./jobs/process-cobol-project");
    var startProcessRouter = require("./jobs/start-processing");
    app.use("/backend/jobs/api/cobol-process", cobolProcessRouter);
    app.use("/backend/jobs/api/csharp-process", startProcessRouter); 
    */

    // GenAI routes
    // all routes are added into gen-ai.routes file under routes folder

    /*
    app.get("/backend/main/api/data-sets", async (request: Request, response: Response) => {
        let collections = <any>request.query.collection;
        let s = collections.map(function (c: string) { return { collection: c } });
        appService.dataSets(s).then((res) => {
            response.status(200).json(res).end();
        }).catch((err) => {
            winstonLogger.error(err, { name: "Error in data-set endpoint", code: "DATA_SET_ENDPOINT" });
        });
    });
    */
    let genAiRoutes = require("./routes/gen-ai.routes");
    app.use("/backend/main/api", genAiRoutes);

    app.use((err: Error, _: Request, response: Response, next: Function) => {
        if (err instanceof AppError) {
            response.status(err.statusCode).json({
                status: 'error',
                message: err.message,
                additionalInfo: err.additionalInfo
            }).end();
        } else {
            response.status(500).json({
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
    app.use('/backend/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { customCss: ".swagger-ui .opblock {margin: 0 0 4px 0px; !important} .swagger-ui .btn {margin-right: 4px;} .swagger-ui .auth-container input[type=password], .swagger-ui .auth-container input[type=text] {min-width: 100%;} .swagger-ui .scheme-container .schemes .auth-wrapper .authorize {margin-right: 4px;} .swagger-ui .auth-btn-wrapper {justify-content: left;} .topbar {display: none !important} .swagger-ui .info {margin: 10px 0 10px 0} .swagger-ui .info hgroup.main {margin: 0px 0 10px;} .swagger-ui .scheme-container {margin: 0; padding: 15px 0;} .swagger-ui .info .title {text-align: center;}" }));
}

const _initDatabaseConfiguration = (dbStatus: any, connection: Db): Promise<{ message: string }> => new Promise(async (res, rej) => {
    try {
        const configPath = resolve(join(__dirname, "config", "db", "init-db.json"));
        const configData = readFileSync(configPath).toString();
        const configJson: any[] = JSON.parse(configData) || [];
        let ftMasterDocs = configJson.find((d) => d.collection === "fileTypeMaster").documents;
        await connection.collection("fileTypeMaster").insertMany(ftMasterDocs);
        let bcmDocs = configJson.find((d) => d.collection === "baseCommandMaster").documents;
        await connection.collection("baseCommandMaster").insertMany(bcmDocs);
        let formattingConfig = configJson.find((d) => d.collection === "formattingConfig").documents;
        await connection.collection("formattingConfig").insertMany(formattingConfig);
        let languageMasters = configJson.find((d) => d.collection === "languageMaster").documents;
        await connection.collection("languageMaster").insertMany(languageMasters);
        let organizationDocs = configJson.find((d) => d.collection === "organizationMaster").documents;
        await connection.collection("organizationMaster").insertMany(organizationDocs);
        let orgMaster = await connection.collection("organizationMaster").findOne({});
        let roleMaster = configJson.find((d) => d.collection === "roleMaster").documents;
        await connection.collection("roleMaster").insertMany(roleMaster);
        let userMaster = configJson.find((d) => d.collection === "userMaster").documents;
        userMaster.forEach((d: UserMaster) => d.oid = orgMaster._id.toString());
        await connection.collection("userMaster").insertMany(userMaster);
        await connection.collection("dbStatus").findOneAndUpdate({ _id: dbStatus?._id }, { $set: { configured: true, enabled: true } }, { upsert: true });
        res({ message: "Database initialization process completed successfully" });
    } catch (error) {
        rej(error);
    }
});