import { articleLanguages } from "@skladno/shared";
import { getProviderLanguageName } from "./editorial-language.js";


export interface AssistantSelectionScope {
    articleId: string;
    fingerprint: string;
    preview: string;
    startOffset: number;
    endOffset: number;
}


export function requestedTranslationLanguages(authorMessage: string, languages: readonly string[]): readonly string[] {
    const unique = [...new Set(languages)];
    const requested = articleLanguages
        .filter((language) => authorMessage.toLowerCase().includes(getProviderLanguageName(language).toLowerCase()));

    return requested.length
        ? requested
        : unique;
}


export async function fingerprintArticleContent(content: string): Promise<string> {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}


export async function getAssistantSelectionScope(articleId: string, snapshot: { markdown: string; preview: string; startOffset: number; endOffset: number }): Promise<AssistantSelectionScope> {
    return {
        articleId,
        fingerprint: await fingerprintArticleContent(snapshot.markdown),
        preview: snapshot.preview,
        startOffset: snapshot.startOffset,
        endOffset: snapshot.endOffset
    };
}
