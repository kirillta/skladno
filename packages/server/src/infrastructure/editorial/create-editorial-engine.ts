import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import { AiSdkEditorialEngine } from "./ai-sdk-editorial-engine.js";


export function createEditorialEngine(options: { apiKey: string; model: string; storeResponses: boolean }): EditorialEngine {
    return new AiSdkEditorialEngine(options);
}
