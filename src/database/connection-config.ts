import Mongoose from 'mongoose';
import { join } from 'path';
import configs from "../configurations";
let auth: { username: string, password: string } = { username: configs.mongoUser, password: configs.mongoPass };
let config: any = { databaseName: configs.mongoDb, mongoHost: configs.mongoHost, mongoPort: configs.mongoPort };
let mongoDbOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    readPreference: 'secondary'
}
if (configs.useMongoAuth) {
    mongoDbOpt = {
        ...mongoDbOpt,
        auth
    };
}
if (configs.mongoSSL) {
    mongoDbOpt = {
        ...mongoDbOpt,
        tls: true,
        tlsCertificateKeyFile: join(configs.crtPath, 'mongodb-client.pem'),
        tlsCAFile: join(configs.crtPath, 'rootCA.pem'),
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false
    };
}
const mongoDbUrl = `mongodb://${config.mongoHost}:${config.mongoPort}/?authSource=admin`;
export { mongoDbOpt, mongoDbUrl, config };