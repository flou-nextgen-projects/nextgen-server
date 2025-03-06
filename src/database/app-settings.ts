
import { MongoClient, Db } from 'mongodb';
import { EventEmitter } from "events";

const mongoDbServer = (connConfig: any) =>
    new Promise((resolve: Function) => {
        let mongoUrl = `mongodb://${connConfig.mongoHost}:${connConfig.mongoPort}/?authSource=admin`;
        let eventEmitter = new EventEmitter();
        const mongoClient: MongoClient = new MongoClient(mongoUrl);
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
        mongoClient.on("open", () => {
            console.log("Database connection with Mongo successfully connected");
            console.log('=======================================================================');
        }).connect().then(client => {            
            const dbConnection: Db = client.db("admin");
            // since this is admin database, we need to create one user which is from connConfig 
            // and then we need to create a database with the name of connConfig.databaseName
            // write code now
            dbConnection.command({
                createUser: connConfig.auth.username,
                pwd: connConfig.auth.password,
                roles: [
                    { role: "readWrite", db: connConfig.databaseName }
                ]
            }).then(() => {
                console.log("User created successfully");
                dbConnection.command({
                    create: connConfig.databaseName
                }).then(() => {
                    console.log("Database created successfully");
                    eventEmitter.emit("connect");
                    resolve(dbConnection);
                }).catch(error => {
                    eventEmitter.emit("error", error);
                });
            }).catch(error => {
                eventEmitter.emit("error", error);
            });
        }).catch(error => {
            eventEmitter.emit("error", error);
        });
    });