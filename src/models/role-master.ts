import Mongoose from "mongoose";
import { EntityBase } from ".";

class RoleMaster extends EntityBase {
    public roleName: string;
    public screens: Array<{ key: string, default: string, description: string, routes?: Array<{ name: string, route: string }> }>;
    public menus: Array<{ mainMenuName: String, id: Mongoose.Schema.Types.ObjectId, route: String, subMenuMaster: Array<{ subMenuName: String, id: Mongoose.Schema.Types.ObjectId, route: String }> }>;
}

const RoleMasterSchema: Mongoose.Schema<RoleMaster> = new Mongoose.Schema<RoleMaster>({
    roleName: { type: String, required: true, select: true },
    screens: { type: [{ key: String, default: String, description: String, routes: Array<{ name: String, route: String }> }], required: true, select: true },
    menus: { type: [{ mainMenuName: String, id: Mongoose.Schema.Types.ObjectId, route: String, subMenuMaster: Array<{ subMenuName: String, id: Mongoose.Schema.Types.ObjectId, route: String }> }], required: false, select: true }
}, { toJSON: { useProjection: true }, toObject: { useProjection: true } });

export { RoleMaster, RoleMasterSchema };