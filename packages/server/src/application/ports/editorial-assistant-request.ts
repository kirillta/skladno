import type { EditorialEngineEvent } from "./editorial-engine-event.js";


export interface EditorialAssistantTool {
    capability: string;
    execute(input: Readonly<Record<string, string>>, signal: AbortSignal): Promise<unknown>;
}


export interface EditorialAssistantRequest {
    message: string;
    article: string;
    scope: "article" | "selection";
    instructions: readonly string[];
    tools: readonly EditorialAssistantTool[];
}


export type EditorialAssistantStream = AsyncIterable<EditorialEngineEvent>;
