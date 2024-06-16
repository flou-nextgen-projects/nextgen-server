import { FileMaster, StatementMaster } from "../../models";
import CobolAdditionalHelperOne from "../cobol/helpers-1";
export default class StatementMasterBase extends CobolAdditionalHelperOne {
    constructor() { super(); }
    prepareStatementMasterStart = function (indicators: string[] | number[], fileMaster: FileMaster, fields?: Partial<StatementMaster>): StatementMaster {
        let sm: StatementMaster = {
            fid: fileMaster._id, indicators,
            lineIndex: 0, pid: fileMaster.pid,
            ...fields
        } as StatementMaster;

        return sm;
    }
}