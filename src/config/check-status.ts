// in this controller, we'll check status of database, whether it is initialized properly or not.
// if database table dbStatus with field configured is false, then we'll initialize process
// of database initial configuration
import Express, { Request, Response, Router, NextFunction } from "express";
import { appService } from "../services/app-service";
import { readFileSync } from "fs";
import { resolve, join } from "path";

const checkDbStatusRouter: Router = Express.Router();

checkDbStatusRouter.use("/", (_: Request, __: Response, next: NextFunction) => {
    next();
}).get("/check-status", async function (_: Request, response: Response) {
    try {
        // Read dbStatus table entries from database
        const dbStatus = await appService.mongooseConnection.collection("dbStatus").findOne();
        // Check if field configured value is false
        if (!dbStatus?.configured) {
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
});

const _initDatabaseConfiguration = (dbStatus: any): Promise<{ message: string }> => new Promise(async (res, rej) => {
    try {
        const configPath = resolve(join(__dirname, "../", "db", "init-db.json"));
        const configData = readFileSync(configPath, { encoding: 'utf8' }).toString();
        const configJson: Array<{ collection: string, documents: [] }> = JSON.parse(configData) || [];
        let bcmDocs = configJson.find((d) => d.collection === "baseCommandMaster").documents;
        await appService.baseCommandMaster.bulkInsert(bcmDocs);
        let ftMasterDocs = configJson.find((d) => d.collection === "fileTypeMaster").documents;
        await appService.fileTypeMaster.bulkInsert(ftMasterDocs);
        let indicators = configJson.find((d) => d.collection === "indicators").documents;
        await appService.mongooseConnection.collection("indicators").insertMany(indicators);
        let languageMasters = configJson.find((d) => d.collection === "languageMaster").documents;
        await appService.languageMaster.bulkInsert(languageMasters);
        let roleMaster = configJson.find((d) => d.collection === "roleMaster").documents;
        await appService.roleMaster.bulkInsert(roleMaster);
        let userMaster = configJson.find((d) => d.collection === "userMaster").documents;
        await appService.userMaster.bulkInsert(userMaster);
        let workspaceMaster = configJson.find((d) => d.collection === "workspaceMaster").documents;
        await appService.workspaceMaster.bulkInsert(workspaceMaster);
        await appService.mongooseConnection.collection("dbStatus").findOneAndUpdate({ _id: dbStatus._id }, { $set: { configured: true, enabled: true } }, { upsert: true });
        res({ message: "Database initialization process completed successfully" });
    } catch (error) {
        rej(error);
    }
});

module.exports = checkDbStatusRouter;