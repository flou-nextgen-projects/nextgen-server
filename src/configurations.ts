import dotenv from "dotenv";
dotenv.config();

export default {
    get nodeEnv() {
        return process.env.NODE_ENV;
    }, get port(): number {
        return parseInt(process.env.PORT) || 9000;
    }, get secretKey() {
        return process.env.SECRET_KEY;
    }, get tenantSecret() {
        return process.env.TEST_TENANT_SECRET;
    }, get kafkaHost() {
        return process.env.KAFKA_BROKER_HOST;
    }, get kafkaPort() {
        return process.env.KAFKA_BROKER_PORT;
    }, get kafkaUrl() {
        return this.nodeEnv === "local" ? `127.0.0.1:${process.env.KAFKA_BROKER_PORT}` : `${process.env.KAFKA_BROKER_HOST}:${process.env.KAFKA_BROKER_PORT}`;
    }, get kafkaTopics() {
        return process.env.KAFKA_TOPICS
    }, get useHttps() {
        return process.env.USE_HTTPS === "true" ? true : false;
    }, get mongoSSL() {
        return process.env.NG_MONGO_SSL === "true" ? true : false;
    }, get mongoDb() {
        return process.env.NG_MONGO_DB;
    }, get mongoUser() {
        return process.env.NG_MONGO_USER;
    }, get mongoPass() {
        return process.env.NG_MONGO_PASS;
    }, get dotNetApiUrl() {
        return process.env.DOTNET_API_URL;
    }, get mongoHost() {
        return process.env.NG_MONGO_HOST;
    }, get mongoPort() {
        return process.env.NG_MONGO_PORT;
    }, get cohereApiKey() {
        return process.env.COHERE_API_KEY;
    }, get genAIUrl() {
        return process.env.GEN_AI_URL;
    }, get crtPath() {
        return process.env.CERT_PATH;
    }
}