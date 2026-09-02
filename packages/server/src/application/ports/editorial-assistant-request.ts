import type { EditorialEngineEvent } from "./editorial-engine-event.js";


export interface EditorialAssistantTool {
    capability: string;
    description: string;
    input: "none" | "proposal-operation" | "target-language" | "title" | "language" | "publishing-profile" | "style-rules" | "artifact-id" | "finding-ids" | "capability-query";
    execute(input: Readonly<Record<string, string>>, signal: AbortSignal): Promise<unknown>;
}


export interface EditorialAssistantRequest {
    message: string;
    article: string;
    scope: "article" | "selection";
    instructions: readonly string[];
    history: readonly { role: "author" | "assistant"; content: string }[];
    skills: readonly { id: string; name: string; description: string; instructions: string }[];
    tools: readonly EditorialAssistantTool[];
    initialActiveCapabilities?: readonly string[];
}


export type EditorialAssistantStream = AsyncIterable<EditorialEngineEvent>;
