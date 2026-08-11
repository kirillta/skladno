import type { BuiltInSkillId, EditorialOperation } from "@skladno/shared";

import type { EditorialEngine } from "./editorial-engine.js";
import type { ProposalSummaryGenerator } from "./proposal-summary-generator.js";


export interface EditorialEngineResolver {
    resolve(operation: EditorialOperation, assistantSkillId?: BuiltInSkillId): EditorialEngine | undefined;
    resolveProposalSummaryGenerator?(): ProposalSummaryGenerator | undefined;
}
