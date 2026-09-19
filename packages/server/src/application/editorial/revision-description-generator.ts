export interface RevisionDescriptionGenerator {
    generate(previousContent: string, content: string, interfaceLocale: string, signal: AbortSignal): Promise<string>;
}
