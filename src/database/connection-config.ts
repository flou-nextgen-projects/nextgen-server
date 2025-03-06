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

let mongoDbOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    readPreference: 'secondary',
    auth
}

if (configs.mongoSSL) {
    mongoDbOpt = {
        ...mongoDbOpt,
        tls: true,
        tlsCertificateKeyFile: join(config.crtPath, 'mongodb-client.pem'),
        tlsCAFile: join(config.crtPath, 'rootCA.pem'),
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false
    };
}

const mongoDbUrl = `mongodb://${config.mongoHost}:${config.mongoPort}/?authSource=admin`;

export { mongoDbOpt, mongoDbUrl, config };