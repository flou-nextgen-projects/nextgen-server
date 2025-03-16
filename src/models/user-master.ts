import Mongoose from "mongoose";
import { EntityBase } from ".";
import { roleMasterVirtuals } from "../virtuals";
var Jwt = require('jsonwebtoken');
var bcryptJs = require('bcryptjs');
import config from "../configurations";
class UserMaster extends EntityBase {
    public tid: Mongoose.Schema.Types.ObjectId | string;
    public userName: string;
    public password: string;
    public firstName: string;
    public lastName: string;
    public email: string;
    public contact: string;
    get fullName(): string {
        return `${this.firstName} ${this.lastName}`;
    }
    public token: string;
    public roleId: Mongoose.Schema.Types.ObjectId | string;
    public lastLogin: Date;
    public isActive: boolean;
    public imageId: Mongoose.Schema.Types.ObjectId;
    public oid: Mongoose.Schema.Types.ObjectId;
}

const UserMasterSchema: Mongoose.Schema<UserMaster> = new Mongoose.Schema<UserMaster>({
    tid: { type: Mongoose.Types.ObjectId, select: true, required: true },
    userName: { type: String, select: true, required: true },
    password: { type: String, select: true, required: true },
    firstName: { type: String, select: true, required: true },
    lastName: { type: String, select: true, required: true },
    email: { type: String, select: true, required: true },
    contact: { type: String, select: true, required: true },
    roleId: { type: Mongoose.Types.ObjectId, select: true, required: true },
    token: { type: String, required: false },
    lastLogin: { type: Date, required: false, default: null },
    isActive: { type: Boolean, required: false, default: true },
    imageId: { type: Mongoose.Types.ObjectId, select: true, required: false },
    oid: { type: Mongoose.Types.ObjectId, select: true, required: false }
}, { toJSON: { useProjection: true }, toObject: { useProjection: true } });

UserMasterSchema.statics.useVirtuals = {
    roleMaster: roleMasterVirtuals
} as any;

UserMasterSchema.pre("save", function (next: Function) {
    var userMaster: any = this;
    if (userMaster.isModified("password")) {
        bcryptJs.genSalt(10, function (err: any, salt: Number) {
            bcryptJs.hash(userMaster.password, salt, function (e: any, hash: any) {
                userMaster.password = hash;
                next();
            });
        });
    } else {
        next();
    }
});

UserMasterSchema.methods.generateAuthToken = function () {
    var userMaster = this.toJSON();
    delete userMaster.password;
    userMaster._id = userMaster._id.toHexString();
    var token = Jwt.sign({ user: userMaster }, config.secretKey, { expiresIn: '24h' }).toString();
    return token;
};
UserMasterSchema.statics.generateAuthTokenOne = function (userMaster: any) {
    delete userMaster.password;
    userMaster._id = userMaster._id.toHexString();
    userMaster.fullName = `${userMaster.firstName} ${userMaster.lastName}`;
    var token = Jwt.sign({ user: userMaster }, config.secretKey, { expiresIn: '24h' }).toString();
    return token;
}

UserMasterSchema.statics.findByCredentials = async function (userName: string, password: string) {
    const user = await this.aggregate([{ $match: { userName: userName } }]);
    if (!user || user.length == 0) {
        return Promise.reject('User not found');
    }
    return await new Promise((resolve, reject) => {
        var u = user.shift();
        bcryptJs.compare(password, u.password, function (err: any, res: any) {
            if (err) reject(err);
            if (res) {
                delete u.password;
                resolve(u);
            } else {
                reject('Invalid username or password');
            }
        });
    });
};

UserMasterSchema.statics.findByObjectId = async function (objectId: string, tid: string) {
    const user = await this.aggregate([{ $match: { _id: Mongoose.Types.ObjectId.createFromHexString(objectId), tid: Mongoose.Types.ObjectId.createFromHexString(tid) } }]);
    if (!user || user.length == 0) {
        return Promise.reject('User not found');
    }
    var u = user.shift();
    delete u.password;
    return Promise.resolve(u);
};

export { UserMaster, UserMasterSchema };
