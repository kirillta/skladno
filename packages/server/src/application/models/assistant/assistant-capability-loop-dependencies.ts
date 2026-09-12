import type { AssistantStore } from "../../ports/assistant-store.js";
import type { EditorialEngineResolver } from "../../ports/editorial-engine-resolver.js";
import type { ConversationHistory } from "./conversation-history.js";
import { AssistantSkillCatalog } from "../../services/assistant/assistant-skill-catalog.js";
import type { EditorialCapabilityCatalog } from "../../services/assistant/editorial-capability-catalog.js";


export interface AssistantCapabilityLoopDependencies {
    assistant: Pick<AssistantStore, "setExecution">;
    engines: Pick<EditorialEngineResolver, "resolveAssistantActionIntentVerifier">;
    capabilities?: Pick<EditorialCapabilityCatalog, "definitions" | "discover" | "read" | "action" | "stream">;
    skills: AssistantSkillCatalog;
    conversationHistory: (articleId: string, limit?: number) => ConversationHistory;
}
