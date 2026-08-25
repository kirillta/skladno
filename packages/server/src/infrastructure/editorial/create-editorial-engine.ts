import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import { AiSdkEditorialEngine } from "./ai-sdk-editorial-engine.js";


export function createEditorialEngine(options: { apiKey: string; model: string; storeResponses: boolean; reasoningEffort?: "low" | "medium" | "high" }): EditorialEngine {
    return new AiSdkEditorialEngine(options);
}
