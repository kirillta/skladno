import { EditorialAssistantTool } from "./editorial-assistant-tool.js";


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
