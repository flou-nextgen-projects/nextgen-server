import Mongoose from 'mongoose';
import configs from "../configurations";
let auth: { username: string, password: string } = { username: configs.mongoUser, password: configs.mongoPass };
let config: any = {
    // auth: auth,
    // user: auth.username,
    // pass: auth.password,
    databaseName: configs.mongoDb,
    mongoDbUrl: `mongodb://${auth.username}:${auth.password}@${configs.mongoHost}:${configs.mongoPort}/?retryWrites=true&serverSelectionTimeoutMS=5000&authSource=admin`
};
const mongoDbOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    readPreference: 'secondary',
    // auth: auth
};
export { mongoDbOpt, config };