import Express, { Request, Response, Router, NextFunction } from "express";
import config from "../configurations";
import { CohereClient } from "cohere-ai";

const aiRouter: Router = Express.Router();

aiRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).get("/get-chat", async function (request: Request, response: Response) {
    const cohere = new CohereClient({ token: config.cohereApiKey || '' });
    try {
        const message = <string>request.query.message;
        const chatStream = await cohere.chatStream({ chatHistory: [], message, model: "command-r", promptTruncation: "AUTO", documents: [], connectors: [{ id: "web-search" }] });
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        for await (const chatMessage of chatStream) {
            if (chatMessage.eventType === 'text-generation') {
                let text = JSON.stringify({ text: chatMessage.text })
                let chunk = `data: ${text}\n\n`;
                response.write(chunk);
            }
        }
        response.end();
    } catch (error) {
        response.status(500).json({ error: error.message });
    }
});

const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = aiRouter;