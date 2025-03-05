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

let mongoDbBaseOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    readPreference: 'secondary',
    auth
}

if (configs.mongoSSL) {
    mongoDbBaseOpt = {
        ...mongoDbBaseOpt,
        tls: true,
        tlsCertificateKeyFile: join(config.crtPath, 'mongodb-client.pem'),
        tlsCAFile: join(config.crtPath, 'rootCA.pem'),
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false
    };
}

const mongoDbOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    tls: true,
    tlsCertificateKeyFile: join(config.crtPath, 'mongodb-client.pem'),
    tlsCAFile: join(config.crtPath, 'rootCA.pem'),
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
    family: 4,
    readPreference: 'secondary',
    auth
};

// if mongodb with tls is not used



const mongoDbUrl = `mongodb://${config.mongoHost}:${config.mongoPort}/?authSource=admin`;

export { mongoDbOpt, mongoDbUrl, config };