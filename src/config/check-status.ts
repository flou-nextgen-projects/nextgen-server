// in this controller, we'll check status of database, whether it is initialized properly or not.
// if database table dbStatus with field configured is false, then we'll initialize process
// of database initial configuration
import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { readFileSync } from "fs";
import { resolve, join } from "path";
import config from "../configurations";
var jwt = require('jsonwebtoken');

const checkDbStatusRouter: Router = Express.Router();

checkDbStatusRouter.use("/", (_: Request, __: Response, next: NextFunction) => {
    next();
}).get("/check-status", async function (_: Request, response: Response) {
    try {
        // Read dbStatus table entries from database
        let dbStatus = await appService.mongooseConnection.collection("dbStatus").findOne();
        if (!dbStatus) {
            let collection = await appService.mongooseConnection.createCollection("dbStatus");
            await collection.insertOne({ configured: false, enabled: false });
            dbStatus = await appService.mongooseConnection.collection("dbStatus").findOne();
        }
        // Check if field configured value is false
        if (!dbStatus.configured) {
            // Start init process of database configuration
            _initDatabaseConfiguration(dbStatus).then((res) => {
                response.status(200).json(res).end();
            }).catch((err) => {
                response.status(500).json(err).end();
            });
        } else {
            response.status(200).json({ message: 'Database is already configured' }).end();
        }
    } catch (error) {
        response.status(500).json({ error: 'Internal server error' }).end();
    }
}).get("/restore-database", async function (_: Request, response: Response) {
    await appService.mongooseConnection.dropCollection("businessSummaries");
    await appService.mongooseConnection.dropCollection("cobolDataSets");
    await appService.mongooseConnection.dropCollection("fieldAndPropertiesDetails");
    await appService.mongooseConnection.dropCollection("fieldAndProperties");
    await appService.mongooseConnection.dropCollection("fileMaster");
    await appService.mongooseConnection.dropCollection("fileContents");
    await appService.mongooseConnection.dropCollection("processingStages");
    await appService.mongooseConnection.dropCollection("projectMaster");
    await appService.mongooseConnection.dropCollection("memberReferences");
    await appService.mongooseConnection.dropCollection("methodDetails");
    await appService.mongooseConnection.dropCollection("statementMaster");
    await appService.mongooseConnection.dropCollection("objectConnectivity");
    await appService.mongooseConnection.dropCollection("workspaceMaster");
    response.status(200).end();
}).post("/generate-token", async function (_: Request, response: Response) {
    try {
        var { startDate, orgId, days, queryCount } = _.body;
        var token = jwt.sign({ _id: orgId, access: 'auth', startDate, days, queryCount }, config.secretKey).toString();
        let orgMaster = await appService.mongooseConnection.collection("organizationMaster").findOne({ orgId: orgId });
        if (orgMaster !== null) {           
            let dbCollection = await appService.mongooseConnection.collection("organizationMaster"); 
            var update = {
                nextGenToken: token,
                genAIToken: token
            }  
            await dbCollection.updateOne({_id: orgMaster._id}, { $set: update });
        }
        response.setHeader("x-genAi-token", token);
        response.status(200).send().end();
    } catch (err) {
        response.status(500).end();
    }
});

const _initDatabaseConfiguration = (dbStatus: any): Promise<{ message: string }> => new Promise(async (res, rej) => {
    try {
        const configPath = resolve(join(__dirname, "db", "init-db.json"));
        const configData = readFileSync(configPath).toString();
        const configJson: any[] = JSON.parse(configData) || [];
        let ftMasterDocs = configJson.find((d) => d.collection === "fileTypeMaster").documents;
        await appService.fileTypeMaster.bulkInsert(ftMasterDocs);
        let bcmDocs = configJson.find((d) => d.collection === "baseCommandMaster").documents;
        await appService.baseCommandMaster.bulkInsert(bcmDocs);
        let formattingConfig = configJson.find((d) => d.collection === "formattingConfig").documents;
        await appService.mongooseConnection.collection("formattingConfig").insertMany(formattingConfig);
        let languageMasters = configJson.find((d) => d.collection === "languageMaster").documents;
        await appService.languageMaster.bulkInsert(languageMasters);
        let roleMaster = configJson.find((d) => d.collection === "roleMaster").documents;
        await appService.roleMaster.bulkInsert(roleMaster);
        let userMaster = configJson.find((d) => d.collection === "userMaster").documents;
        await appService.userMaster.bulkInsert(userMaster);
        // let workspaceMaster = configJson.find((d) => d.collection === "workspaceMaster").documents;
        // await appService.workspaceMaster.bulkInsert(workspaceMaster);
        await appService.mongooseConnection.collection("dbStatus").findOneAndUpdate({ _id: dbStatus?._id }, { $set: { configured: true, enabled: true } }, { upsert: true });
        res({ message: "Database initialization process completed successfully" });
    } catch (error) {
        rej(error);
    }
});

module.exports = checkDbStatusRouter;