import fetch from 'node-fetch';
import axios from "axios";
import config from "../configurations";
import { ObjectId } from "mongoose";

/*
const crtPath = resolve(__dirname, "../", 'certificates');
const httpsAgent: https.Agent = new https.Agent({
    ca: readFileSync(join(crtPath, 'rootCA.pem')), 
    cert: readFileSync(join(crtPath, 'device.crt')),
    key: readFileSync(join(crtPath, 'device.key')),    
    keepAlive: true, rejectUnauthorized: true
});
*/
const axiosInstance = axios.create({ baseURL: config.dotNetApiUrl });
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