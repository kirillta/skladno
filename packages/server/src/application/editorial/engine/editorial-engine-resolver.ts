import type { BuiltInSkillId, EditorialOperation } from "@skladno/shared";

import type { EditorialEngine } from "./editorial-engine.js";
import type { ProposalSummaryGenerator } from "../proposals/proposal-summary-generator.js";
import type { ArticleTitleGenerator } from "../article-title-generator.js";
import type { RevisionDescriptionGenerator } from "../revision-description-generator.js";
import type { AssistantActionIntentVerifier } from "../assistant-action-intent-verifier.js";


export interface EditorialEngineResolver {
    resolve(operation: EditorialOperation, assistantSkillId?: BuiltInSkillId): EditorialEngine | undefined;
    resolveAssistant?(): EditorialEngine | undefined;
    resolveProposalSummaryGenerator?(): ProposalSummaryGenerator | undefined;
    resolveArticleTitleGenerator?(): ArticleTitleGenerator | undefined;
    resolveRevisionDescriptionGenerator?(): RevisionDescriptionGenerator | undefined;
    resolveAssistantActionIntentVerifier?(): AssistantActionIntentVerifier | undefined;
}
