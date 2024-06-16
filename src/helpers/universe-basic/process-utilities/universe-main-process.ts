import Mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { appService } from "../../../services/app-service";
import { commonHelper, universeUtilities, universeBasicProcessHelpers } from "../";
import { FileMaster, ProjectDirInfo, ProjectMaster } from "../../../models";

export default class UniVerseMainProcessUtils {
    constructor() { };
    public changeExtensionStep = (project: ProjectMaster) => new Promise((resolve: Function, reject: Function) => {
        try {
            const extRefPromise = appService.fileTypeMaster.getDocuments({ lid: project._id });
            extRefPromise.then(function (fileTypeMaster) {
                fileTypeMaster.forEach(function (fileType: any) {
                    commonHelper.changeExtensions(project.extractedPath, fileType.fileTypeExtension, fileType.folderNames);
                });
                resolve();
            });
            extRefPromise.catch(function (err: Mongoose.Error) {
                reject();
            });
        } catch (error) {
            reject(error)
        }
    });
    public fileMasterImportStep = (project: ProjectMaster) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const fileTypeMaster = await appService.fileTypeMaster.getDocuments({ lid: project.lid });
            const rootPath: string = project.extractedPath;
            if (!fs.existsSync(rootPath)) resolve();
            const rootDirectories = fs.readdirSync(rootPath);
            for (const dir of rootDirectories) {
                const dirInfo = {
                    pid: project._id,
                    rootPath: rootPath,
                    dirName: dir,
                    dirCompletePath: path.join(rootPath, dir)
                } as ProjectDirInfo;
                await appService.projectDirInfo.addItem(dirInfo)
            }
            const files: string[] = universeUtilities.getAllFilesFromPath(rootPath, []);
            for (const file of files) {
                var fileMaster: FileMaster = commonHelper.prepareFileMasterObject(file, project, fileTypeMaster);
                await appService.fileMaster.addItem(fileMaster);
            }
            resolve(files);
        } catch (error) {
            reject(error);
        }
    });
    public processFileMenuStep = (project: ProjectMaster) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            var menuFilePath = path.join(project.extractedPath, "Menu", "MENUS.csv");
            var res: Promise<any> = await universeBasicProcessHelpers.processMenuFile(project, menuFilePath);
            resolve(res);
        } catch (error) {
            reject({ message: "Error occurred while menu file processing", error });
        }
    });
    public processDataDictionaryStep = (project: ProjectMaster) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const res: Promise<any> = await universeBasicProcessHelpers.processUniVerseDataDictionary(project);
            resolve(res);
        } catch (error) {
            reject({ message: "Error occurred while data dictionary files processing!", error });
        }
        finally {
            console.log("Data dictionary files processing step completed successfully!.");
        }
    });
    public processUniverseDescriptorsStep = (project: ProjectMaster) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const res: unknown = await universeBasicProcessHelpers.processUniverseDescriptors(project);
            resolve(res);
        } catch (error) {
            reject({ message: "Error occurred while I-Descriptor files processing!", error });
        }
        finally {
            console.log("I-Descriptor files processing step completed successfully!.");
        }
    });
    public processUniVerseFilesStep = (type: string, extension: string, project: ProjectMaster) => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const res: any = await universeBasicProcessHelpers.processUniVerseFileTypes(type, extension, project);
            resolve(res);
        } catch (error) {
            reject({ message: "Error occurred while UniVerse file types processing!", error });
        }
        finally {
            console.log("UniVerse file types processing step completed successfully!.");
        }
    });
    public processFileContentsStep = (project: ProjectMaster): Promise<any> => new Promise(async (resolve: Function, reject: Function) => {
        try {
            const res: any = await universeBasicProcessHelpers.processFileContentMaster(project);
            resolve(res);
        } catch (error) {
            reject({ message: "Error occurred while UniVerse file types processing!", error });
        }
        finally {
            console.log("UniVerse file types processing step completed successfully!.");
        }
    });
}

const universeMainProcessUtils: UniVerseMainProcessUtils = new UniVerseMainProcessUtils();
export { universeMainProcessUtils, UniVerseMainProcessUtils };