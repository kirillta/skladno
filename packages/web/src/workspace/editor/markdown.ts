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
    $convertFromMarkdownString(content, articleMarkdownTransformers, undefined, true);
}


export function exportArticleMarkdown(): string {
    return $convertToMarkdownString(articleMarkdownTransformers, undefined, true);
}
