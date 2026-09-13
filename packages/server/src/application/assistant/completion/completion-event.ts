import type { EditorialEngineEvent } from "../../editorial/engine/editorial-engine-event.js";

export type CompletionEvent = Extract<EditorialEngineEvent, { type: "completed" }>;
