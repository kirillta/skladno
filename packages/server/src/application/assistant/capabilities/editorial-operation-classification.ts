import type { EditorialCapabilityId } from "./editorial-capability-id.js";

export type WorkspaceDestination = "write" | "proposal" | "revisions" | "fact-check" | "style-profile" | "translations" | "settings" | "article-library" | "article-status";
export type EditorialOperationClassificationKind = "callable-read" | "callable-action" | "callable-artifact" | "workspace-handoff" | "excluded";


export interface EditorialOperationClassification {
    id: string;
    kind: EditorialOperationClassificationKind;
    outcome: string;
    aliases: readonly string[];
    capability?: EditorialCapabilityId;
    destination?: WorkspaceDestination;
    reason?: string;
}
