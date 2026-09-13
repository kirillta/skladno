export interface ArticleTitleGenerator {
    generate(content: string, signal: AbortSignal): Promise<string>;
}
