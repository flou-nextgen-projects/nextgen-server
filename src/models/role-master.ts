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

enum UserRoles {
    SUPER_ADMIN = "superAdmin",
    ADMIN = "admin",
    USER_ADMIN = "userAdmin",
    SITE_ADMIN = "siteAdmin",
    NORMAL_USER = "normalUser"
}
class OrganizationMaster extends EntityBase {
    public orgId: number;
    public orgName: string;
    public tid: Mongoose.Schema.Types.ObjectId;
    public nextGenToken?: string;
    public genAiToken?: string;
}

const OrganizationMasterSchema: Mongoose.Schema<OrganizationMaster> = new Mongoose.Schema<OrganizationMaster>({
    orgId: { type: Number, required: true, select: true },
    orgName: { type: String, required: true, select: true },
    tid: { type: Mongoose.Types.ObjectId, required: true, select: true },
    nextGenToken: { type: String, required: false, select: false },
    genAiToken: { type: String, required: false, select: false }
}, { toJSON: { useProjection: true }, toObject: { useProjection: true } });

export { RoleMaster, RoleMasterSchema, UserRoles, OrganizationMaster, OrganizationMasterSchema };