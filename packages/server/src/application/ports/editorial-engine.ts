import type { EditorialConversationRequest } from "./editorial-conversation-request.js";
import type { EditorialAssistantRequest } from "./editorial-assistant-request.js";
import type { EditorialEngineEvent } from "./editorial-engine-event.js";
import type { EditorialEngineRequest } from "./editorial-engine-request.js";


export interface EditorialEngine {
    stream(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent>;
    streamConversation(request: EditorialConversationRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent>;
    streamAssistant?(request: EditorialAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent>;
}
