export interface RevisionDescriptionGenerator {
    generate(previousContent: string, content: string, signal: AbortSignal): Promise<string>;
}
