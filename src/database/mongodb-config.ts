const globalAny: any = global;
import { MongoClient, Db } from 'mongodb';
import { EventEmitter } from "events";
import { mongoDbOpt, config, mongoDbUrl } from './connection-config';
const mongoDbServer = () =>
  new Promise((resolve: Function) => {
    let eventEmitter = new EventEmitter();
    const mongoClient: MongoClient = new MongoClient(mongoDbUrl, mongoDbOpt as any);
    eventEmitter.on('connect', function () {
      console.log('Database connection with MongoDB driver succeeded!');
      console.log('=======================================================================');
    });
    eventEmitter.on("error", (err) => {
      console.log('=======================================================================');
      console.log('There was error while connecting to database!');
      console.log(err);
      console.log('=======================================================================');
    });
    mongoClient.on("open", () => {
      console.log("Database connection with MongoDB successfully connected!");
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

module.exports = mongoDbServer;