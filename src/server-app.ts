console.clear();
require('source-map-support').install();
const globalAny: any = global;
import Express from 'express';
import { join, resolve } from 'path';
import chalk from "chalk";
import http2 from "http2";
import { existsSync, mkdirSync, readFileSync } from 'fs';
import app, { setAppRoutes } from "./express-app";
import config from './configurations';
import { ConsoleLogger } from "nextgen-utilities";

const logger: ConsoleLogger = new ConsoleLogger(__filename);
process.on('unhandledRejection', (reason, _) => {
    logger.error('Unhandled Rejection at:', { reason });
});

app.use(Express.static(join(__dirname, '../', 'html')));

/* // before starting the server, we need to check whether the app-db.json file is present or not
if (!existsSync(join(__dirname, '../', 'app-db.json'))) {
    console.log('=======================================================================');
    console.log('app-db.json file is missing!');
    console.log('=======================================================================');
    app.listen(config.port, function () {
        console.log('=======================================================================');
        console.log(`Server Host application is running on port: ${config.port}`);
        console.log('=======================================================================');
    });
    // @ts-ignore
    return;
}
// if above condition is met, then we need to return from here and do not execute any further code
 */

console.log('=======================================================================');

import './database/mongoose-config';
import mongoDbServer from './database/mongodb-config';

async function mongoConnection() {
    globalAny.mongoDbConnection = await mongoDbServer();
}
Promise.resolve(mongoConnection()).then(() => {
    let uploadFolders = ["file-uploads", "uploaded-projects", "extracted-projects"];
    uploadFolders.forEach((dir) => {
        const uploadPath = join(__dirname, "../", dir);
        if (!existsSync(uploadPath)) { mkdirSync(uploadPath); }
    });

    setAppRoutes(app);

    const startNodeJsServer = (protocol: string, server: http2.Http2SecureServer | Express.Application) => {
        server.listen(config.port, async function () {
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
            console.log(`Server Host application is running on port: ${config.port} with protocol: ${protocol}`);
            console.log(JSON.stringify(address));
            console.log('=======================================================================');
        });
    };

    if (config.useHttps === "true") {
        const crtPath = resolve(__dirname, 'certificates');
        const httpsOptions: http2.SecureServerOptions = {
            cert: readFileSync(join(crtPath, 'device.crt')),
            key: readFileSync(join(crtPath, 'device.key')),
            allowHTTP1: true,
            ALPNProtocols: ["h2"]
        };
        let http2SecureServer: http2.Http2SecureServer = http2.createSecureServer(httpsOptions, app as any);
        startNodeJsServer("HTTPS", http2SecureServer);
    } else {
        startNodeJsServer("HTTP", app);
    }
});

export default app;