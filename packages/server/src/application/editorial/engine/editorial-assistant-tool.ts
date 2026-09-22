export interface EditorialAssistantTool {
    capability: string;
    description: string;
    input: "none" | "proposal-operation" | "target-language" | "title" | "language" | "publishing-profile" | "style-rules" | "artifact-id" | "finding-ids" | "capability-query" | "author-skill" | "author-skill-id" | "author-skill-write" | "author-skill-restore" | "author-skill-delete" | "author-skill-revision";
    execute(input: Readonly<Record<string, string>>, signal: AbortSignal): Promise<unknown>;
}
