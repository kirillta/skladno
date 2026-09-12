import type { EditorialEngineEvent } from "../editorial/editorial-engine-event.js";

export type CompletionEvent = Extract<EditorialEngineEvent, { type: "completed" }>;
