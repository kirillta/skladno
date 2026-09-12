import type { EditorialEngineEvent } from "../../ports/editorial-engine-event.js";

export type CompletionEvent = Extract<EditorialEngineEvent, { type: "completed" }>;
