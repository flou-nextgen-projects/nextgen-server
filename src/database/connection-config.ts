import Mongoose from 'mongoose';
import configs from "../configurations";
let auth: { username: string, password: string } = { username: configs.mongoUser, password: configs.mongoPass };
let config: any = {
    // auth: auth,
    // user: auth.username,
    // pass: auth.password,
    databaseName: configs.mongoDb,
    mongoDbUrl: `mongodb://localhost:27000/yogesh-latest?ssl=false`
    // mongoDbUrl: `mongodb://${auth.username}:${auth.password}@${configs.mongoHost}:${configs.mongoPort}/?retryWrites=true&loadBalanced=false&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000&authSource=admin&authMechanism=SCRAM-SHA-256`
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