console.clear();
require('source-map-support').install();
const globalAny: any = global;
import Express from 'express';
import { join, resolve } from 'path';
import chalk from "chalk";
import './database/mongoose-config';
import http2 from "http2";
import mongoDbServer from './database/mongodb-config';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import app, { setAppRoutes } from "./express-app";
import config from './configurations';
import { ConsoleLogger } from "nextgen-utilities";

async function mongoConnection() {
    globalAny.mongoDbConnection = await mongoDbServer();
}

const logger: ConsoleLogger = new ConsoleLogger(__filename);
process.on('unhandledRejection', (reason, _) => {
    logger.error('Unhandled Rejection at:', { reason });
});

console.log('=======================================================================');
Promise.resolve(mongoConnection()).then(() => {
    let uploadFolders = ["file-uploads", "uploaded-projects", "extracted-projects"];
    uploadFolders.forEach((dir) => {
        const uploadPath = join(__dirname, "../", dir);
        if (!existsSync(uploadPath)) { mkdirSync(uploadPath); }
    });
    app.use(Express.static(join(__dirname, '')));
    const crtPath = resolve(__dirname, 'certificates');
    const httpsOptions: http2.SecureServerOptions = {
        cert: readFileSync(join(crtPath, 'device.crt')),
        key: readFileSync(join(crtPath, 'device.key')),
        allowHTTP1: true,
        ALPNProtocols: ["h2"]
    };
    const httpsServer = http2.createSecureServer(httpsOptions, app as any);
    setAppRoutes(app);
    httpsServer.listen(config.port, async function () {
        const address: any = this.address();
        await mongoConnection();
        if (!globalAny.dbConnection) {
            console.log('=======================================================================');
            console.log(`Database connection failed!!!`);
            console.log('=======================================================================');
        }
        console.log('=======================================================================');
        const dt = new Date().toLocaleString("en-us")
        console.log(chalk.red("Restarted app: " + chalk.green(dt)));
        console.log(`Server Host application is up running on port: ${config.port}`);
        console.log(JSON.stringify(address));
        console.log('=======================================================================');
    });
});

export default app;