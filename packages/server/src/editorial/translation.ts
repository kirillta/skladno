export interface ProtectedArticle {
    protectedSpans: string[];
    protectedText: string;
}


const protectedSpanPattern = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s)\]}>]+|\b[A-Za-z][A-Za-z0-9]*(?:[._/:#-][A-Za-z0-9_./:#-]+)+\b/g;


/** Replaces exact technical spans with stable tokens before the provider sees the article. */
export function protectArticleSpans(article: string): ProtectedArticle {
    const protectedSpans: string[] = [];
    const protectedText = article.replace(protectedSpanPattern, (span) => {
        const token = `[[SKLADNO_PROTECTED_${protectedSpans.length}]]`;
        protectedSpans.push(span);

        return token;
    });

    return { protectedSpans, protectedText };
}


/** Restores tokens only when every protected span is present exactly once. */
export function restoreProtectedSpans(text: string, protectedSpans: readonly string[]): string | undefined {
    let restored = text;

    for (let index = 0; index < protectedSpans.length; index += 1) {
        const token = `[[SKLADNO_PROTECTED_${index}]]`;
        const appearances = restored.split(token).length - 1;
        if (appearances !== 1)
            return undefined;

        restored = restored.replace(token, protectedSpans[index]);
    }

    return /\[\[SKLADNO_PROTECTED_\d+\]\]/.test(restored) ? undefined : restored;
}
