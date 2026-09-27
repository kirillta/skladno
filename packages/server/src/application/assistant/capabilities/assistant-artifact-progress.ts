import type { EditorialEngineEvent } from "../../editorial/engine/editorial-engine-event.js";
import { EDITORIAL_ENGINE_EVENT } from "../../editorial/engine/editorial-engine-events.js";
import type { PreparedAssistantRequest } from "../requests/prepared-assistant-request.js";
import { EDITORIAL_CAPABILITY } from "./editorial-capability-id.js";
import type { EditorialCapabilityDefinition } from "./editorial-capability-definition.js";


export function captureArtifactProgress(request: PreparedAssistantRequest, definition: EditorialCapabilityDefinition, event: Exclude<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>, onProgress: (event: EditorialEngineEvent) => void): void {
    if (definition.id !== EDITORIAL_CAPABILITY.FACT_CHECK)
        return;

    if (event.type === EDITORIAL_ENGINE_EVENT.FACT_CHECK_PROGRESS)
        request.partialFactCheck = event.factCheck;
    else if (event.type === EDITORIAL_ENGINE_EVENT.TOOL_STATUS && event.claims)
        onProgress(event);
}
