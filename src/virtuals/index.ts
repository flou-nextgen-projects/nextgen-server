const languageMasterVirtuals = {
    path: "languageMaster",
    value: {
        from: "languageMaster",
        localField: "lid",
        foreignField: "_id",
        as: "languageMaster",
        ref: "languageMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true,
    fields: ["name", "description"]
};

const fileTypeMasterVirtuals = {
    path: "fileTypeMaster",
    value: {
        from: "fileTypeMaster",
        localField: "fileTypeId",
        foreignField: "_id",
        as: "fileTypeMaster",
        ref: "fileTypeMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true
};

const workspaceMasterVirtuals = {
    path: "workspaceMaster",
    value: {
        from: "workspaceMaster",
        localField: "wid",
        foreignField: "_id",
        as: "workspaceMaster",
        ref: "workspaceMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true,
    fields: { _id: 1, workspaceName: 1, workspaceDescription: 1 }
};

const projectMasterVirtuals = {
    path: "projectMaster",
    value: {
        from: "projectMaster",
        localField: "pid",
        foreignField: "_id",
        as: "projectMaster",
        ref: "projectMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true
};

const fileMasterVirtuals = {
    path: "fileMaster",
    value: {
        from: "fileMaster",
        localField: "fid",
        foreignField: "_id",
        as: "fileMaster",
        ref: "fileMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true,
    fields: ["_id", "fileId", "projectId", "fileTypeMasterId", "fileName", "fileNameWithoutExt", "workFlowStatus", "projectMaster", "fileTypeExtensionMaster"]
};

const referenceFileMasterVirtuals = {
    path: "fileMaster",
    value: {
        from: "fileMaster",
        localField: "referenceFileId",
        foreignField: "_id",
        as: "referenceFileMaster",
        ref: "fileMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true,
    fields: ["_id", "fileId", "fileName", "fileNameWithoutExt", "workFlowStatus", "projectMaster", "fileTypeExtensionMaster"]
};

const baseCommandMasterVirtuals = {
    path: "baseCommandMaster",
    value: {
        from: "baseCommandMaster",
        localField: "baseCommandId",
        foreignField: "_id",
        as: "baseCommandMaster",
        ref: "baseCommandMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true
};

const roleMasterVirtuals = {
    path: "roleMaster",
    value: {
        from: "roleMaster",
        localField: "roleId",
        foreignField: "_id",
        as: "roleMaster",
        ref: "roleMaster",
        autopopulate: true,
        justOne: true
    },
    unWind: true
};

export {
    languageMasterVirtuals,
    workspaceMasterVirtuals,
    projectMasterVirtuals,
    fileTypeMasterVirtuals,
    fileMasterVirtuals,
    baseCommandMasterVirtuals,
    referenceFileMasterVirtuals,
    roleMasterVirtuals
};
