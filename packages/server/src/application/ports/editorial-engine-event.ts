import type { FactCheck, StyleReview, TranslationMetadata } from "@skladno/shared";

import { EDITORIAL_ENGINE_EVENT } from "./editorial-engine-events.js";


export type EditorialEngineEvent =
    | { type: typeof EDITORIAL_ENGINE_EVENT.TEXT_DELTA; delta: string }
    | { type: typeof EDITORIAL_ENGINE_EVENT.TOOL_STATUS; tool: string; status: "started" | "completed" }
    | { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED; responseId: string; text: string; styleReview?: StyleReview; factCheck?: FactCheck; translation?: TranslationMetadata; editorialArtifactId?: string };
