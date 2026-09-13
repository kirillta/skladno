import type { EditorialCapabilityId } from "./editorial-capability-id.js";
import type { EditorialCapabilityInput } from "./editorial-capability-input.js";

export type EditorialCapabilityResultKind = "article" | "linked-articles" | "revisions" | "draft" | "artifacts" | "proposal-summary" | "fact-checks" | "publishing-guidance" | "style-corpus" | "style-rules" | "translations" | "proposal" | "fact-check" | "style-review" | "translation";


export interface EditorialCapabilityDefinition {
    id: EditorialCapabilityId;
    allowedContext: "article";
    selectionCompatible?: boolean;
    input: EditorialCapabilityInput;
    execution: "read" | "artifact" | "action";
    prerequisite?: "style-corpus" | "target-language";
    result: EditorialCapabilityResultKind;
    retry: "never" | "transient-read";
    activity: string;
}
