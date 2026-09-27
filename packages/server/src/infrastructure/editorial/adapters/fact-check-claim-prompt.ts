export function createFactCheckClaimPrompt(article: string, previousFindings: { claim: string }[]): string {
    return `Phase: claim extraction\n\nPreviously checked claims (include only if still stated in the Article):\n${JSON.stringify(previousFindings.map(({ claim }) => claim))}\n\nArticle:\n${article}`;
}
