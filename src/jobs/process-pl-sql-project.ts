import { PlSqlProcessToExecute } from "../helpers/pl-sql/pl-sql-process";
import Mongoose from "mongoose";
import { WinstonLogger } from "nextgen-utilities";

const winstonLogger: WinstonLogger = new WinstonLogger(__filename);
export default class ProcessPlSqlProjects {
    executeProcessActionsOnyByOne = async (pid: string | Mongoose.Types.ObjectId) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const plSqlProcessToExecute: PlSqlProcessToExecute = new PlSqlProcessToExecute(pid);
            // await plSqlProcessToExecute.processFileMasterData(pid);
            // await plSqlProcessToExecute.dumpFileContents(pid);
            await plSqlProcessToExecute.processPlSqlFiles(pid);
            resolve({ status: 'success' });
        } catch (error) {
            winstonLogger.error(error, { code: "PLSQL-1001", name: "PLSQL" });
            reject({ error });
        }
    });
}