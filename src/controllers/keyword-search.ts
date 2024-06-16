import { Request, Response } from "express";
import { appService } from "../services/app-service";

const keywordSearch = function (request: Request, response: Response) {
    const searchOptions: any = request.body;
    const searchKeywords: string[] = searchOptions.searchKeyword.split(',');
    const searchRegExp: RegExp = new RegExp(searchKeywords.join("|"), "i");
    appService.statementMaster.getModel().find({
        OriginalStatement: searchRegExp
    }).limit(10).then((res) => {
        response.status(200).json(res).end();
    }).catch(err => {
        response.status(500).json(err).end();
    });
};

module.exports = { keywordSearch };