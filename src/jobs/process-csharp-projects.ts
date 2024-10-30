import fetch from 'node-fetch';
import axios from "axios";
import config from "../configurations";
import { ObjectId } from "mongoose";
import https from "https";
import { readFileSync } from "fs";
import { resolve, join } from "path";

const crtPath = resolve(__dirname, "../", 'certificates');
const axiosInstance = axios.create({ baseURL: config.dotNetApiUrl, auth: { username: config.mongoUser, password: config.mongoPass } });
const httpAgent: https.Agent = new https.Agent({
    ca: readFileSync(join(crtPath, 'rootCA.pem')), cert: readFileSync(join(crtPath, 'device.crt')),
    key: readFileSync(join(crtPath, 'device.key')), pfx: readFileSync(join(crtPath, 'device.pfx')), keepAlive: true, rejectUnauthorized: false
});

export default class ProcessCsharpProjects {
    startProcessing(wid: string | ObjectId): Promise<fetch.Response> {
        return fetch(`${config.dotNetApiUrl}/dotnet/api/job/csharp/execute-actions-one-by-one?wid=${wid}`);
    }
}