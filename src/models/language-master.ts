import { Schema } from "mongoose";
import EntityBase from "./entity-base";

interface LanguageMaster extends EntityBase {
    name: string;
    description?: string;
}

const LanguageMasterSchema: Schema<LanguageMaster> = new Schema({
    name: {
        required: true, type: String, unique: true
    }, description: {
        required: false, type: String
    }
});

export { LanguageMasterSchema, LanguageMaster };
