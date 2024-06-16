export class CobolConstants {
    static regExProc = new RegExp("(EXEC\\s*PROC\\s*=)", "i");
    static regExPgm = new RegExp("(EXEC\\s*PGM\\s*=)", "i");
    static regExPgmFile = new RegExp("(EXEC\\s*PGM\\s*=(\\s*[A-z0-9\\&]+))", "i");
    static regExPattern = new RegExp("EXEC(\\s*[A-z0-9]+)", "i");
    static regExCall = new RegExp("^CALL\\s+(.+?\\s+)", "i");
    static regExCopy = new RegExp("^([\\+]+)?COPY\\s([\\w]+)", "i");
    static regExInclude = new RegExp("^([\\+]+)?INCLUDE\\s([\\w]+)", "i");
    static regExInputPattern = new RegExp("INPUTLIB\\(([^)]*)\\)", "i");
    static callExtRegExScreen = new RegExp("SEND\\s+TO\\s+USER\\s+SCREEN|RECEIVE\\s+USER\\s+SCREEN", "i");
    static callExtRegExProgram = new RegExp("XCTL\\s+PROGRAM.*\\(\'(?<ObjName>[A-z0-9\\s]+)\'\\)", "i");
    static regExInput = new RegExp("INPUTLIB\\(([^)]*)\\)|RUN\\s*PROGRAM\\s*\\((.*?)\\)", "i");
    static regExIncludeMember = new RegExp("^INCLUDE\\s+MEMBER\\s*=\\s*([A-z0-9]+)", "i");
    static cobolSections = [
        { sectionId: 1, sectionName: "IDENTIFICATION DIVISION." },
        { sectionId: 2, sectionName: "ENVIRONMENT DIVISION." },
        { sectionId: 3, sectionName: "DATA DIVISION." },
        { sectionId: 4, sectionName: "WORKING-STORAGE SECTION." },
        { sectionId: 5, sectionName: "LINKAGE SECTION." },
        { sectionId: 6, sectionName: "PROCEDURE DIVISION." },
        { sectionId: 7, sectionName: "CONFIGURATION SECTION." },
        { sectionId: 8, sectionName: "INPUT-OUTPUT SECTION." },
        { sectionId: 9, sectionName: "FILE-CONTROL." },
        { sectionId: 10, sectionName: "FILE SECTION." },
        { sectionId: 11, sectionName: "SPECIAL-NAMES." }
    ]
}