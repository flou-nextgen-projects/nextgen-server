import { UserMaster } from "../models"
declare global {
    namespace Express {
        interface Request {
            user?: UserMaster;
        }
    }
}