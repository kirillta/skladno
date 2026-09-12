import type { EditorialConversationRequest } from "../../models/editorial/editorial-conversation-request.js";
import type { EditorialAssistantRequest } from "../../models/editorial/editorial-assistant-request.js";
import type { EditorialEngineEvent } from "../../models/editorial/editorial-engine-event.js";
import type { EditorialEngineRequest } from "../../models/editorial/editorial-engine-request.js";


export interface EditorialEngine {
    readonly continuationScope?: { connectionId: string; provider: import("@skladno/shared").AiProvider; model: string };
    stream(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent>;
    streamConversation(request: EditorialConversationRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent>;
    streamAssistant?(request: EditorialAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent>;
}
