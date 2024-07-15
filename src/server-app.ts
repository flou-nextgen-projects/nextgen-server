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
import { Logger, WinstonLogger } from "yogeshs-utilities";
const winstonLogger: WinstonLogger = new WinstonLogger(__filename);

winstonLogger.info("Completed changing file type extensions", { code: "0001", name: "processing", numVal: 7081, strVal: "fileType: COBOL" });
winstonLogger.info("Another message", { code: "0002", name: "filtering", numVal: 3422, strVal: "{name: 'yogeshs', age: 38}" });
winstonLogger.info("This is loggers info", { name: "yogeshs", code: "log-1001", extras: { name: "yogesh", age: 40, birthPlace: "Undirwadi" } });
winstonLogger.info("This is sayali sonawane", { name: "sayalis", code: "log-1002", extras: { name: "sayali", age: 34 } });
winstonLogger.error(new Error("Unknown error"), { name: 'error', code: "err-5001" });
winstonLogger.info('This is an informational message', { code: 'value1', name: 'value2' });
winstonLogger.error(new Error('This is an error message'), { code: "123", name: "error" });
winstonLogger.debug('This is a debug message', { name: 'some debug info', code: "1234-34" });
winstonLogger.warn('This is a warn');
winstonLogger.warn('This is a warning', { name: 'some debug info', code: "no-code" });

async function mongoConnection() {
    globalAny.mongoDbConnection = await mongoDbServer();
}

const logger: Logger = new Logger(__filename);
process.on('unhandledRejection', (reason, _) => {
    logger.error('Unhandled Rejection at:', { reason });
});

console.log('=======================================================================');
Promise.resolve(mongoConnection()).then(() => {
    const uploadPath = join(__dirname, 'file-uploads');
    if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath);
    }
    app.use(Express.static(uploadPath));
    app.use(Express.static(join(__dirname, 'public')));
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