import fs from "fs";
import path from "path";

export default class ProcessCsv {
    private _replaceContentsForEscapeChar = function (filePath: string): string {
        var fileBuffer = fs.readFileSync(filePath).toString().split("\n");
        var lineArray = "";
        fileBuffer.forEach(function (line) {
            var stringArray: string[] = [];
            if (typeof line === "undefined" || line === "" || !line) return;
            line.split(/\,(?!(?<=(?:^|,)\\s*"(?:[^"]|""|\\")*,)(?:[^"]|""|\\")*"\\s*(?:,|$))/).forEach(function (match) {
                stringArray.push(match);
            });
            lineArray += stringArray.join(",").concat('\n');
        });
        const fileName = path.basename(filePath);
        const modifiedFile = `modified-${fileName}`;
        const dirName = path.dirname(filePath);
        const modifiedFilePath = path.join(dirName, modifiedFile);
        if (fs.existsSync(modifiedFilePath)) { fs.unlinkSync(modifiedFilePath); }
        fs.writeFileSync(modifiedFilePath, lineArray);
        return modifiedFilePath;
    };
    /**
     * name
     */
    public processCsv = (filePath: string) => new Promise(async (resolve: Function, reject: Function) => {
        const fastCsv: any = require("fast-csv");
        var fileData: any[] = [];
        const modifiedFilePath = this._replaceContentsForEscapeChar(filePath); // Ex. "ID","Ap.key:"*":seq.nbr","Bp2010.temp"
        fs.createReadStream(modifiedFilePath).pipe(fastCsv.parse({
            headers: true
        }).on("data", async (data: any) => {
            fileData.push(data);
        }).on("error", (error: any) => {
            reject({ message: "Error occurred while menu file processing", error });
        }).on("end", () => {
            console.log('All data dictionary files processed successfully!.');
            resolve({ message: "Menu file processed successfully!!", data: fileData });
        }));
    });

    stripHtmlTags(source: string, params: string[]): string {
        if (source === "") return "";
        var original = source;
        params.forEach((tagName) => {
            var regex = new RegExp(`</?${tagName}( [^>]*|/)?>`, "igm");
            original = original.replace(/<.*?\/>/igm, "");
            original = original.replace(regex, "");
            original = original.replace(/&nbsp;/igm, " ");
        });
        return original;
    };

    getEquivalentSpaces(indentLevel: number): string {
        var spacesList = " ";
        for (var i = 0; i < indentLevel; i++) {
            spacesList += " ";
        }
        return spacesList;
    }

    equivalentSpaces(indentLevel: number): string {
        var spacesList = "&nbsp;";
        for (var i = 0; i < indentLevel; i++) {
            spacesList += "&nbsp;";
        }
        return spacesList;
    }
    generateOrderId() {
        const currentDate = new Date(); // Note: Months are 0-based in JavaScript, so 9 represents October
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Adding 1 because months are 0-based
        const day = currentDate.getDate().toString().padStart(2, '0');
        // Generate a random 4-digit number for the order ID
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const orderID = `${year}-${month}-${day}-${randomDigits}`;
        return orderID;
    }
}