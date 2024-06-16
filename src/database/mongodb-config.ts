const globalAny: any = global;
import { MongoClient, Db } from 'mongodb';
import { EventEmitter } from "events";
import { mongoDbOpt, config } from './connection-config';
const mongoDbServer = () =>
  new Promise((resolve: Function, reject: Function) => {
    let eventEmitter = new EventEmitter();
    const mongoClient: MongoClient = new MongoClient(config.mongoDbUrl, mongoDbOpt as any);
    eventEmitter.on('connect', function () {
      console.log('Database connection with MongoDb Driver succeeded!!');
      console.log('=======================================================================');
    });
    eventEmitter.on("error", (err) => {
      console.log('=======================================================================');
      console.log('There was error while connecting to database!');
      console.log(err);
      console.log('=======================================================================');
    });
    mongoClient.on("open", (client: MongoClient) => {      
      console.log("Database connection with Mongo successfully connected");           
      console.log('=======================================================================');
    }).connect().then(client => {
      globalAny.mongoDbClient = mongoClient as MongoClient;
      const dbConnection: Db = client.db(config.databaseName);
      eventEmitter.emit("connect");
      resolve(dbConnection);
    }).catch(error => {
      eventEmitter.emit("error", error);
    });
  });

export default mongoDbServer;