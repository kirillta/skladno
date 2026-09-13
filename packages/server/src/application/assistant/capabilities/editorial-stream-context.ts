import type { BuiltInSkillId, EditorialOperation } from "@skladno/shared";

import type { EditorialCapabilityContext } from "./editorial-capability-context.js";
import type { EditorialCapabilityId } from "./editorial-capability-id.js";


export interface StreamContext {
    capability: Extract<EditorialCapabilityId, "generate_proposal" | "generate_finding_corrections" | "fact_check" | "style_review" | "translate">;
    context: EditorialCapabilityContext;
    requestId: string;
    authorContext: string;
    skillId?: BuiltInSkillId;
    targetArticleCharacterLimit?: number;
    operation?: Extract<EditorialOperation, "thesis_to_narrative" | "flow_revision">;
    targetLanguage?: string;
    findingIds?: string;
    articleContent?: string;
    articleSelection?: boolean;
    surroundingArticleCharacterCount?: number;
}
