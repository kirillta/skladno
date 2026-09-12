export function boundedArticleContext(content: string): string {
    const maximumCharacters = 24_000;
    if (content.length <= maximumCharacters)
        return content;

    const half = Math.floor(maximumCharacters / 2);

    return `${content.slice(0, half)}\n\n[Middle of article omitted to bound editorial context.]\n\n${content.slice(-half)}`;
}
