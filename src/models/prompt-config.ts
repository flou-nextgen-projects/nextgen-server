import { Schema } from "mongoose";
import EntityBase from "./entity-base";
import { number } from "cohere-ai/core/schemas";

interface PromptConfigMaster extends EntityBase {
    promptId: number;
    prompt: string;
    menuId: string;
    menu: string;
    location: string;
    cohereModel?: string;
    claudeModel?: string;
    mistralModel?: string;

}

const PromptConfigMasterSchema: Schema<PromptConfigMaster> = new Schema({
    promptId: {
        required: true, type: Number, unique: true
    }, prompt: {
        required: true, type: String
    },
    menuId: {
        required: true, type: String
    },
    menu: {
        required: true, type: String
    },
    location: {
        required: true, type: String
    },
    cohereModel: {
        required: false, type: String
    },
    mistralModel: {
        required: false, type: String
    },
    claudeModel: {
        required: false, type: String
    }
});

export { PromptConfigMasterSchema, PromptConfigMaster };
