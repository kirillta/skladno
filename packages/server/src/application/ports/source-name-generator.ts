export interface SourceNameGenerator {
    generate(content: string, signal: AbortSignal): Promise<string>;
}
