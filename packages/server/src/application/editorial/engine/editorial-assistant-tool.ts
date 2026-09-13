

export interface EditorialAssistantTool {
    capability: string;
    description: string;
    input: "none" | "proposal-operation" | "target-language" | "title" | "language" | "publishing-profile" | "style-rules" | "artifact-id" | "finding-ids" | "capability-query";
    execute(input: Readonly<Record<string, string>>, signal: AbortSignal): Promise<unknown>;
}
