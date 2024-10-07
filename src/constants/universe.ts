export default class UniVerseConstants {
    static csvSplitRegex = (delimiter: string) => new RegExp(`\\${delimiter}(?!(?<=(?:^|,)\\s*"(?:[^"]|""|\\\\")*,)(?:[^"]|""|\\\\")*"\\s*(?:,|$))`, "ig");
}
