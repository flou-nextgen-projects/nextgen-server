export default class CobolConstants {
    static RegularExpressions = {
        regExProc: new RegExp("(EXEC\\s*PROC\\s*=)", "i"),
        regExPgm: new RegExp("(EXEC\\s*PGM\\s*=)", "i"),
        crudRegEx: new RegExp(/^SELECT\s+|^UPDATE\s+|^DELETE\s+|^INSERT\s+/i),
        entityCrudRegEx: new RegExp(/^READ\s+(.*?\s+)|^WRITE\s+(.*)|^REWRITE\s+(.*?\s+)/i),
        regExPgmFile: new RegExp("(EXEC\\s*PGM\\s*=(\\s*[A-z0-9\\&]+))", "i"),
        regExPattern: new RegExp("EXEC(\\s*[A-z0-9]+)", "i"),
        regExCall: new RegExp("^CALL\\s+(.+?\\s+)", "i"),
        regExCopy: new RegExp("^([\\+]+)?COPY\\s([\\w]+)", "i"),
        regExInclude: new RegExp("^([\\+]+)?INCLUDE\\s([\\w]+)", "i"),
        regExInputPattern: new RegExp("INPUTLIB\\(([^)]*)\\)", "i"),
        callExtRegExScreen: new RegExp("SEND\\s+TO\\s+USER\\s+SCREEN|RECEIVE\\s+USER\\s+SCREEN", "i"),
        callExtRegExProgram: new RegExp("XCTL\\s+PROGRAM.*\\(\'(?<ObjName>[A-z0-9\\s]+)\'\\)", "i"),
        regExInput: new RegExp("INPUTLIB\\(([^)]*)\\)|RUN\\s*PROGRAM\\s*\\((.*?)\\)", "i"),
        regExIncludeMember: new RegExp("^INCLUDE\\s+MEMBER\\s*=\\s*([A-z0-9]+)", "i"),
        regexEndPerform: /^END-PERFORM.$|^END-PERFORM$/i,        
    };

    static cobolSections = [
        { sectionId: 1, sectionName: "IDENTIFICATION DIVISION." },
        { sectionId: 2, sectionName: "ENVIRONMENT DIVISION." },
        { sectionId: 3, sectionName: "DATA DIVISION." },
        { sectionId: 4, sectionName: "WORKING-STORAGE SECTION." },
        { sectionId: 5, sectionName: "LINKAGE SECTION." },
        { sectionId: 6, sectionName: "PROCEDURE DIVISION.", regEx: new RegExp(/^PROCEDURE DIVISION(.*)/i) },
        { sectionId: 7, sectionName: "CONFIGURATION SECTION." },
        { sectionId: 8, sectionName: "INPUT-OUTPUT SECTION." },
        { sectionId: 9, sectionName: "FILE-CONTROL." },
        { sectionId: 10, sectionName: "FILE SECTION." },
        { sectionId: 11, sectionName: "SPECIAL-NAMES." }
    ]
}