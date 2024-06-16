import { resolve, join } from 'path';
import Mongoose from 'mongoose';
let auth: { username: string, password: string } = { username: "yogeshs", password: "yogeshs" };
// let info: { port: number, host: string } = { port: 27000, host: "127.0.0.1" };
let config: any = {
    auth: auth,
    userName: auth.username,
    password: auth.password,
    databaseName: "flokapture",
    // mongoDbUrl: `mongodb://${info.host}:${info.port}/?ssl=true`,
    mongoDbUrl: `mongodb+srv://${auth.username}:${auth.password}@dotnet-cluster.ttt9rr4.mongodb.net/?retryWrites=true&w=majority`,
    // crtPath: resolve(__dirname, '../', 'certificates')
};
const mongoDbOpt: Mongoose.ConnectOptions = {
    dbName: config.databaseName,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    // tlsCertificateKeyFile: join(config.crtPath, 'mongo-client.pem'),
    // tlsCAFile: join(config.crtPath, 'root-ca.pem'),
    family: 4,
    readPreference: 'secondary',
    auth: auth
};
export { mongoDbOpt, config };