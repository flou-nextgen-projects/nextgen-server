import Mongoose from 'mongoose';
import configs from "../configurations";
let auth: { username: string, password: string } = { username: configs.mongoUser, password: configs.mongoPass };
let config: any = {
    auth: auth,
    userName: auth.username,
    password: auth.password,
    databaseName: configs.mongoDb,
    mongoDbUrl: `mongodb+srv://${auth.username}:${auth.password}@dotnet-cluster.ttt9rr4.mongodb.net/?retryWrites=true&w=majority`,
};
const mongoDbOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    readPreference: 'secondary',
    auth: auth
};
export { mongoDbOpt, config };