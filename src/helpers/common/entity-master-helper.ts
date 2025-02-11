import Mongoose from "mongoose";
import { appService } from "../../services/app-service";
import { EntityMaster } from "../../models";
async function extractDataEntities(reqBody: any, pid: string, fid: string) {
    try {
        const variables = JSON.parse(reqBody);
        // let isValid = isValidJSON(variables);
        // if (!isValid) return { success: false, error: "Invalid json", code: 3 };
        const entities = variables.entities;
        if (Array.isArray(entities)) {
            for (const element of entities) {
                const document = {
                    entityName: element.entityName,
                    fid: Mongoose.Types.ObjectId.createFromHexString(fid),
                    pid: Mongoose.Types.ObjectId.createFromHexString(pid),
                    attributes: element.attributes,
                } as EntityMaster;
                await appService.entityMaster.addItem(document);
            }
        } else {
            for (const key in entities) {
                if (Object.prototype.hasOwnProperty.call(entities, key)) {
                    const element = entities[key];
                    const entityName = key;
                    const document = {
                        entityName: entityName,
                        fid: Mongoose.Types.ObjectId.createFromHexString(fid),
                        pid: Mongoose.Types.ObjectId.createFromHexString(pid),
                        attributes: element.attributes,
                    } as EntityMaster;
                    await appService.entityMaster.addItem(document);
                }
            }
        }
        return { success: true, message: "Data saved successfully.", code: 1 };
    } catch (error) {
        return { success: false, error: error.message, code: 2 };
    }
}

function isValidJSON(jsonString: string): boolean {
    try {
        JSON.parse(jsonString);
        return true;
    } catch (error) {
        return false;
    }
}
export default extractDataEntities;