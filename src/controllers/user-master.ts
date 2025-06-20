
import Express, { Request, Response, Router, NextFunction } from "express";
import Mongoose, { PipelineStage } from "mongoose";
import { isEmpty } from "lodash";
const userRouter: Router = Express.Router();
import AppService from "../services/app-service";
import { UserMaster } from "../models";
import { ObjectId } from "mongodb";
const bcrypt = require('bcryptjs');
var Jwt = require('jsonwebtoken');
import config from "../configurations";

const appService: AppService = new AppService();

userRouter.use("/", (request: Request, response: Response, next: NextFunction) => {
    next();
}).post("/", async function (request: Request, response: Response) {
    try {
        var user = request.body;
        if (isEmpty(user.oid)) return response.status(400).json({ code: 400, message: "Incomplete user info", data: {} }).end();
        let orgMaster = await appService.organizationMaster.getItem({ _id: ObjectId.createFromHexString(user.oid) });
        user.tid = orgMaster.tid;
        var UserMaster = appService.userMaster.getModel();
        var newUser: any = new UserMaster(user);
        appService.userMaster.getItem({ userName: user.userName }).then((userResult: UserMaster) => {
            if (userResult) {
                var res = { message: "User already exists" };
                response.status(200).json(res).end();
            } else {
                newUser.save().then(() => {
                    response.status(200).json({ message: "User registered successfully" }).end();
                }).catch((e: Mongoose.Error) => {
                    response.status(400).json({ code: 400, message: e.message, data: e }).end();
                });
            }
        }).catch((error: Mongoose.Error) => {
            response.status(400).json({ code: 400, message: error.message, data: error }).end();
        });
    } catch (error) {
        response.status(400).json({ code: 400, message: error.message, data: error }).end();
    }
}).post("/upload", (request: Request, response: Response, next: NextFunction) => {
}).get("/get-all", function (request: Request, response: Response) {
    var pipelineOne: Array<PipelineStage> = [{ $lookup: { from: "roleMaster", localField: "roleId", foreignField: "_id", as: "roleMaster" } }, { $unwind: { path: "$roleMaster", preserveNullAndEmptyArrays: true } }];
    appService.userMaster.aggregate(pipelineOne).then((users) => {
        users.forEach((d) => delete d.password);
        response.status(200).json(users).end();
    }).catch((err) => {
        response.status(404).json(err).end();
    })
}).get("/search-user", (request: Request, response: Response, next: NextFunction) => {
    let keyword: string = <string>request.query.keyword;
    typeof keyword === 'undefined' || keyword === "" ? keyword = "''" : keyword;
    var searchTerms = keyword.split(',');
    var regexSearchTerms = searchTerms.map(term => new RegExp(term, "ig"));
    var pipelineOne = [{ $lookup: { from: "roleMaster", localField: "roleId", foreignField: "_id", as: "roleMaster" } }, { $unwind: { path: "$roleMaster", preserveNullAndEmptyArrays: true } }];
    var pipeline = [{ $match: { $or: [{ userName: { $in: regexSearchTerms } }, { email: { $in: regexSearchTerms } }, { contact: { $in: regexSearchTerms } }] } },
    { $match: { isActive: true } },
    { $lookup: { from: "roleMaster", localField: "roleId", foreignField: "_id", as: "roleMaster" } },
    { $unwind: { path: "$roleMaster", preserveNullAndEmptyArrays: true } }];
    if (keyword == "''") pipeline = pipelineOne;
    appService.userMaster.aggregate(pipeline).then((result) => {
        result.forEach((d) => delete d.password);
        response.status(200).json(result).end();
    }).catch(() => {
        response.status(500).end();
    })
}).post("/update-user", (request: Request, response: Response) => {
    var user = request.body;
    appService.userMaster.updateDocument({ _id: Mongoose.Types.ObjectId.createFromHexString(user._id) }, user).then((result) => {
        var res = { code: 200, message: "User updated successfully.", data: result };
        response.status(200).send(res).end();
    }).catch((err) => {
        response.status(500).end();
    });
}).get("/get-roles", function (request: Request, response: Response) {
    appService.roleMaster.getAllDocuments().then((roles: Array<any>) => {
        response.status(200).json(roles).end();
    }).catch((err: Mongoose.Error) => {
        response.status(404).end();
    });
}).get("/get-users-by-roleId/:id", function (request: Request, response: Response) {
    var roleId = <string>request.params.id;
    let _id = new ObjectId(roleId);
    appService.userMaster.getDocuments({ roleId: _id } as any).then((users) => {
        response.status(200).json(users).end();
    }).catch(() => {
        response.status(500).end();
    });
}).post("/forgot-password", function (request: Request, response: Response) {
    const email = request.body.email;
    appService.userMaster.getItem({ email: email }).then((user) => {
        if (user) {
            response.status(200).json(user).end();
        } else {
            response.status(404).end();
        }
    }).catch(() => {
        response.status(500).end();
    });
}).post("/update-profile-img", (request: Request, response: Response) => {
    var { userId, imgId } = request.body;
    appService.userMaster.updateDocument({ _id: userId }, { $set: { imageId: imgId } }).then((result) => {
        response.status(200).send().end();
    }).catch((err) => {
        response.status(500).end();
    });
}).post("/get-profile-img", (request: Request, response: Response) => {
    var userId: string = request.body.userId;
    appService.userMaster.aggregate([
        { $match: { _id: ObjectId.createFromHexString(userId) } },
        { $lookup: { from: "imageMaster", localField: "imageId", foreignField: "_id", as: "imageMaster" } },
        { $unwind: { path: "$imageMaster", preserveNullAndEmptyArrays: true } }
    ]).then((result) => {
        var res = { code: 200, message: "Image successful.", data: result };
        response.status(200).send(res).end();
    }).catch(() => {
        response.status(500).end();
    });
}).post("/change-password", async (request: Request, response: Response) => {
    try {
        const { current, newPwd, confirm } = request.body;
        let authHeader = request.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return response.status(401).json({ code: 401, message: 'Token missing', data: null });
        }
        const user = await Jwt.verify(token, config.secretKey)
        if (!user) {
            return response.status(404).json({ code: 404, message: "User not found", data: null });
        }
        let userDetails = await appService.userMaster.getItem({ userName: user.user.userName });
        const isOldPasswordValid = await bcrypt.compare(current, userDetails.password);
        if (!isOldPasswordValid) {
            return response.status(401).json({ code: 401, message: "Old password is incorrect", data: null });
        }
        const hashedNewPassword = await bcrypt.hash(newPwd, 10);
        await appService.userMaster.updateDocument({ userName: userDetails.userName }, { password: hashedNewPassword });
        response.status(200).json({ message: "Password changed successfully" });
    } catch (err) {
        response.status(500).json(err).end();
    }
});


module.exports = userRouter;
