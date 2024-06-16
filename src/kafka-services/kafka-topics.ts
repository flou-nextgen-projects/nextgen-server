import Express, { Request, Response, Router, NextFunction } from "express";
import { ITopicConfig, Kafka, Partitioners, logLevel } from 'kafkajs';
import socketFactory from "../middleware/socket-factory";
import config from "../configurations";
const kafkaBrokers = [config.kafkaUrl];
const kafka = new Kafka({ logLevel: logLevel.ERROR, clientId: 'yogeshs-app', brokers: kafkaBrokers, socketFactory: socketFactory({ host: config.kafkaHost, port: config.kafkaPort }) });
const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner, allowAutoTopicCreation: true });
const topicRouter: Router = Express.Router();
topicRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/create/:topic", async function (request: Request, response: Response) {
    const topic: string = <string>request.params.topic;
    try {
        const admin = kafka.admin();
        await admin.connect();
        const topicToCreate: ITopicConfig = {
            topic: topic, numPartitions: 1, replicationFactor: 1,
            configEntries: [{ name: 'cleanup.policy', value: 'delete' }, { name: "retention.ms", value: "3600000" },
            { name: "retention.bytes", value: "10240000" }, { name: "delete.retention.ms", value: "86400000" },
            { name: "max.message.bytes", value: "1048588" }]
        };
        let created = await admin.createTopics({ topics: [topicToCreate], timeout: 3000, validateOnly: false, waitForLeaders: false });
        await admin.disconnect();
        if (!created) {
            response.status(500).json({ message: "Topic was not created" }).end();
        } else {
            response.status(201).json({ message: "Topic created successfully", status: "OK", data: topicToCreate });
        }
    } catch (err) {
        err.identifier = `Topic ${topic} was not created`;
        response.status(500).json(err).end();
    }
}).get("/list-topics", async function (request: Request, response: Response) {
    const admin = kafka.admin();
    try {
        await admin.connect();
        const list = await admin.listTopics();
        response.status(200).json({ data: list }).end();
    } catch (err) {
        response.status(500).json(err).end();
    } finally {
        await admin.disconnect();
    }
}).post("/produce-message/:topic", async function (request: Request, response: Response) {
    try {
        const topic: string = <string>request.params.topic;
        let msgBody = JSON.stringify(request.body)
        await producer.connect();
        const metadata = await producer.send({ topic, messages: [{ value: msgBody }], acks: 1, timeout: 6000 });
        response.status(200).json({ message: 'Message produced successfully', data: metadata }).end();
    } catch (error) {
        if (error.name === 'KafkaJSProtocolError') {
            console.error(`Kafka protocol error: ${error.type}`);
        }
        if (error.stack) {
            console.error(error.stack);
        }
        response.status(500).json({ error }).end();
    } finally {
        await producer.disconnect();
    }
});

module.exports = topicRouter;