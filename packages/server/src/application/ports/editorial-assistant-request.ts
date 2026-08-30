import type { EditorialEngineEvent } from "./editorial-engine-event.js";


export interface EditorialAssistantTool {
    capability: string;
    description: string;
    input: "none" | "proposal-operation" | "target-language";
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
}


export type EditorialAssistantStream = AsyncIterable<EditorialEngineEvent>;
