import {
    $convertFromMarkdownString,
    $convertToMarkdownString,
    BOLD_ITALIC_STAR,
    BOLD_STAR,
    CODE,
    HEADING,
    INLINE_CODE,
    ITALIC_STAR,
    LINK,
    ORDERED_LIST,
    QUOTE,
    STRIKETHROUGH,
    UNORDERED_LIST,
    type Transformer,
} from "@lexical/markdown";


/** The complete persisted Article Markdown contract. Markdown shortcuts are intentionally not registered. */
export const articleMarkdownTransformers: Transformer[] = [
    HEADING,
    QUOTE,
    UNORDERED_LIST,
    ORDERED_LIST,
    CODE,
    INLINE_CODE,
    BOLD_ITALIC_STAR,
    BOLD_STAR,
    ITALIC_STAR,
    STRIKETHROUGH,
    LINK,
];


export function importArticleMarkdown(content: string): void {
    $convertFromMarkdownString(encodeLinkDestinationParentheses(content), articleMarkdownTransformers, undefined, true);
}


export function exportArticleMarkdown(): string {
    return encodeLinkDestinationParentheses($convertToMarkdownString(articleMarkdownTransformers, undefined, true));
}


function encodeLinkDestinationParentheses(markdown: string): string {
    let result = "";
    let cursor = 0;
    let fenced = false;

    while (cursor < markdown.length) {
        const lineEnd = markdown.indexOf("\n", cursor);
        const end = lineEnd < 0 ? markdown.length : lineEnd;
        const line = markdown.slice(cursor, end);
        const trimmed = line.trimStart();
        if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
            fenced = !fenced;
            result += line;
        } else if (fenced) {
            result += line;
        } else {
            result += encodeMarkdownLine(line);
        }

        if (lineEnd >= 0)
            result += "\n";

        cursor = end + 1;
    }

    return result;
}


function encodeMarkdownLine(line: string): string {
    let result = "";
    let inlineCode = false;
    for (let index = 0; index < line.length; index++) {
        const character = line[index];
        if (character === "`")
            inlineCode = !inlineCode;

        if (!inlineCode && character === "]" && line[index + 1] === "(" && line.lastIndexOf("[", index) >= 0) {
            const destination = encodeDestination(line, index + 2);
            if (destination) {
                result += `](${destination.value}`;
                index = destination.end - 1;

                continue;
            }
        }

        result += character;
    }

    return result;
}


function encodeDestination(line: string, start: number): { value: string; end: number } | undefined {
    let depth = 0;
    let value = "";

    for (let index = start; index < line.length; index++) {
        const character = line[index];
        if (character === "(") {
            depth++;
            value += "%28";
        } else if (character === ")" && depth > 0) {
            depth--;
            value += "%29";
        } else if (character === ")" && depth === 0) {
            return { value: `${value})`, end: index + 1 };
        } else if (character === " " || character === "\t") {
            return undefined;
        } else {
            value += character;
        }
    }

    return undefined;
}
