// we need to use this file for additional const / env variables
import dotenv from "dotenv";
dotenv.config();

export default {
    get port(): number {
        return parseInt(process.env.PORT) || 3900;
    }, get secretKey() {
        return process.env.SECRET_KEY;
    }, get tenantSecret() {
        return process.env.TEST_TENANT_SECRET;
    }, get razorPayKeyId() {
        return process.env.RAZORPAY_KEY_ID;
    }, get razorPayKeySecret() {
        return process.env.RAZORPAY_KEY_SECRET;
    }, get razorPayWebhookSecret() {
        return process.env.RAZORPAY_WEBHOOK_KEY;
    }, get kafkaHost() {
        return process.env.KAFKA_BROKER_HOST;
    }, get kafkaPort() {
        return process.env.KAFKA_BROKER_PORT;
    }, get kafkaUrl() {
        return `${process.env.KAFKA_BROKER_HOST}:${process.env.KAFKA_BROKER_PORT}`;
    }, get kafkaTopics() {
        return process.env.KAFKA_TOPICS
    }, get useHttps() {
        return process.env.USE_HTTPS || true;
    }
}