const globalAny: any = global;
import Mongoose from 'mongoose';
import { config } from './connection-config';

const mongoDbOpt: Mongoose.ConnectOptions = {
  dbName: config.databaseName,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4,
  readPreference: 'secondary',
  readConcern: 'majority',
  auth: config.auth
};

const dbServer = function () {
  Mongoose.Promise = global.Promise;
  return Mongoose.createConnection(config.mongoDbUrl, mongoDbOpt).on('connected', function () {
    console.log('Database connection succeeded!!');
    console.log('=======================================================================');
  }).on('disconnected', function () {
    console.log('Database connection has been disconnected!!');
    console.log('=======================================================================');
  }).on('close', function () {
    console.log('Database connection is closed!!');
    console.log('=======================================================================');
  }).on('error', function () {
    console.log('Database connection failed!!');
    console.log('=======================================================================');
  });
};
const dbConnection: Mongoose.Connection = dbServer();
exports.dbConnection = globalAny.dbConnection = dbConnection;