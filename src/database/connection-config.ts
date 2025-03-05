import Mongoose from 'mongoose';
import { join } from 'path';
import configs from "../configurations";

let auth: { username: string, password: string } = { username: configs.mongoUser, password: configs.mongoPass };

let config: any = {
    databaseName: configs.mongoDb,
    crtPath: configs.crtPath,
    mongoHost: configs.mongoHost,
    mongoPort: configs.mongoPort,
    auth
};

const mongoDbOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    tls: true,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    tlsCertificateKeyFile: join(config.crtPath, 'mongodb-client.pem'),
    tlsCAFile: join(config.crtPath, 'rootCA.pem'),
    tlsAllowInvalidCertificates: false,
    family: 4,
    readPreference: 'secondary',
    auth
};

const mongoDbUrl = `mongodb://${config.mongoHost}:${config.mongoPort}/?authSource=admin`;

export { mongoDbOpt, mongoDbUrl, config };