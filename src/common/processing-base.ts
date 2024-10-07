import { ProjectMaster } from "../models";

// All processes will be language specific, so depending upon languageId and even for fileTypeName too.
// call required function from common utilities, if missing, then add it
// if process is specific to language, then add that function in respective utilities, and use it here
// for ex. cobol variables track report.
export default class ProcessingBase {
    processFileContents = async function (project: ProjectMaster) { }
    // This function will collect all action workflows and dump data into actionWorkflows collection
    processToGetAllActionWorkflows = async function (project: ProjectMaster) { }
    // This function will take all action workflows from actionWorkflow collection and process
    processAllActionWorkflows = async function (project: ProjectMaster) { }
    processDataDependency = async function (project: ProjectMaster) { }
    processCrudActivities = async function (project: ProjectMaster) { }
    processAttributeLevelCrudActivities = async function (project: ProjectMaster) { }
    processProjectInventory = async function (project: ProjectMaster) { }
    processDataInventory = async function (project: ProjectMaster) { }
    processObjectConnectivityDiagram = async function (project: ProjectMaster) { }
}