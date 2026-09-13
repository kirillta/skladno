import type { EditorialCapabilityId } from "./editorial-capability-id.js";
import type { EditorialCapabilityInput } from "./editorial-capability-input.js";
import type { EditorialOperationClassificationKind, WorkspaceDestination } from "./editorial-operation-classification.js";


export interface EditorialCapabilityDiscoveryResult {
    operationId: string;
    classification: EditorialOperationClassificationKind;
    outcome: string;
    requiredInput?: EditorialCapabilityInput;
    capability?: EditorialCapabilityId;
    destination?: WorkspaceDestination;
    reason?: string;
}
