import fetch from 'node-fetch';
import axios from "axios";
import config from "../configurations";
import { ObjectId } from "mongoose";
import https from "https";
import { readFileSync } from "fs";
import { resolve, join } from "path";

const crtPath = resolve(__dirname, "../", 'certificates');
const httpsAgent: https.Agent = new https.Agent({
    ca: readFileSync(join(crtPath, 'rootCA.pem')), 
    cert: readFileSync(join(crtPath, 'device.crt')),
    key: readFileSync(join(crtPath, 'device.key')),
    // pfx: readFileSync(join(crtPath, 'device.pfx')), 
    keepAlive: true, rejectUnauthorized: true
});
const axiosInstance = axios.create({ baseURL: config.dotNetApiUrl, httpsAgent });

export default class ProcessCsharpProjects {
    startProcessing(wid: string | ObjectId): Promise<fetch.Response> {
        return fetch(`${config.dotNetApiUrl}/dotnet/api/job/csharp/execute-actions-one-by-one?wid=${wid}`);
    }
    async processProject(wid: string | ObjectId): Promise<any> {
        try {
            let res = await axiosInstance.get(`${config.dotNetApiUrl}/dotnet/api/job/csharp/execute-actions-one-by-one?wid=${wid}`);
            return res;
        } catch (err) {
            console.log(err);
        }
    }
}