interface String {
    /**
    * Removes html tag and returns plain text.
    * @param: this string
    */
    stripHtmlTags(): string;
    pseudoCodeForAddStatement(cLine: string): string;
    pseudoCodeForMoveStatement(cLine: string): string;
    pseudoCodeForFetchStatement(cLine: string): string;
    pseudoCodeForComputeStatement(cLine: string): string;
};
String.prototype.pseudoCodeForComputeStatement = function (cLine: string): string {
    let mainLine = '';
    const regexPattern = new RegExp(/COMPUTE ([a-zA-Z0-9\-\s\.\$\"\,\/\:\=\&\+\(\)\@\*\|\\_\#\[\]\{\}\;\?\!\']+) = ([a-zA-Z0-9\-\s\.\$\"\,\/\:\=\&\+\(\)\@\*\|\\_\#\[\]\{\}\;\?\!\']+)/, 'i');
    if (!regexPattern.test(cLine)) return mainLine;
    const allGroups = regexPattern.exec(cLine);
    if (allGroups) {
        const value = allGroups[1];
        const groupSecond = allGroups[2];
        mainLine = `SET ${value} TO ${groupSecond}`;
    }
    return mainLine;
}

String.prototype.pseudoCodeForFetchStatement = function (cLine: string): string {
    return cLine.replace("FETCH", "Retrieve from DB table");
};
String.prototype.stripHtmlTags = function (): string {
    if (typeof this === "undefined" || null === this) return "";
    let inputString: string = this;
    inputString = inputString.replace(new RegExp("</?span( [^>]*|/)?>", "i"), "");  // RegExp.(source, @"</?span( [^>]*|/)?>", string.Empty);
    inputString = inputString.replace(new RegExp("</?img( [^>]*|/)?>", "i"), "i");
    var regEx = new RegExp("<.*?>", "i");
    var ignoreStatement = regEx.exec(inputString);
    if (!ignoreStatement /* && ignoreStatement.length > 2 && typeof ignoreStatement[1] === "number" */) return inputString;
    let plainText: string = inputString.replace(new RegExp("<.*?>", "i"), "");
    let myString: string = plainText.replace(/\s+/i, " ");
    plainText = myString.replace(/\s/i, "");
    return plainText;
};
String.prototype.pseudoCodeForAddStatement = function (cLine: string): string {
    let mainLine = '';
    const regexPattern = new RegExp(/ADD (([a-zA-Z0-9\-\s\\_\.\""\,\;\/\'\(\)]+)) TO (([a-zA-Z0-9\-\s\\_\.\""\,\;\/\'\(\)\#\-]+))/, 'i');
    const match = cLine.match(regexPattern);
    if (!match) return mainLine;
    const value = match[1];
    const groupThird = match[3];
    mainLine = `SET ${groupThird} TO ${groupThird} + ${value}`;
    return mainLine;
};
String.prototype.pseudoCodeForMoveStatement = function (cLine: string): string {
    let mainLine = '';
    const regexPattern = new RegExp(/MOVE ([A-Za-z0-9\w\(\)\<\>\-\"\'\:\+\,\*\s\"\.=\/\#\\_]*) TO ([A-Za-z0-9\w\(\)\<\+\,\>\-\"\'\:\*\s\"\.=\/\#\\_]*)/, 'i');
    const match = cLine.match(regexPattern);
    if (!match) return mainLine;
    const value = match[1];
    const groupSecond = match[2];
    mainLine = `SET ${groupSecond} TO ${value}`;
    return mainLine;
}