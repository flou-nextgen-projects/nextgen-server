import { Kafka, logLevel } from 'kafkajs';
import config from "../configurations";
import socketFactory from '../middleware/socket-factory';
import { Logger } from 'yogeshs-utilities';
const logger: Logger = new Logger(__filename);
const kafkaBrokers = [config.kafkaUrl];
const kafka = new Kafka({ logLevel: logLevel.ERROR, clientId: 'yogeshs-app', brokers: kafkaBrokers, socketFactory: socketFactory({ host: config.kafkaHost, port: config.kafkaPort }) });
const consumer = kafka.consumer({ groupId: 'yogeshs-kafka', heartbeatInterval: 10000, rebalanceTimeout: 90000, sessionTimeout: 60000 });
consumer.on("consumer.crash", () => {
    console.log("There is error in Kafka Broker.");
});
consumer.on("consumer.network.request_timeout", () => {
    console.log("Request Timeout.");
});
consumer.on("consumer.stop", () => {
    console.log("Consumer stopped.");
});
consumer.on("consumer.disconnect", () => {
    console.log("Consumer disconnected.");
});
const runConsumer = async () => {   
    await consumer.connect();
    consumer.on("consumer.connect", () => {
        logger.success("Consumer connected successfully.");
    });
    const topicRegEx: RegExp[] = config.kafkaTopics.split(',').map((d) => new RegExp(d, "ig"));
    await consumer.subscribe({ fromBeginning: true, topics: topicRegEx });
    consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const msgBody = JSON.parse(message.value.toString());
            // from here, process message for
            // 1. file processing steps - process file in parts
            console.log({ value: msgBody, headers: message.headers, topic, partition, offset: message.offset });
            await consumer.commitOffsets([{ topic, partition, offset: (message.offset + 1) }]);
        },
        eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary, uncommittedOffsets, isRunning, isStale }) => {
            console.log(`Received batch with ${batch.messages.length} messages from topics ${topicRegEx.join(', ')}`);
            for (const message of batch.messages) {
                const msgBody = JSON.parse(message.value.toString());
                console.log({ value: msgBody, topic: batch.topic, partition: batch.partition, offset: message.offset });
            }
            resolveOffset(batch.highWatermark);
            if (uncommittedOffsets.length > 10) {
                await commitOffsetsIfNecessary();
            }
            if (isStale()) {
                console.log('Consumer is stale. Reconnecting...');
                await consumer.disconnect();
                await consumer.connect();
                await consumer.subscribe({ topics: topicRegEx });
            }
        }
    });
};
// runConsumer();