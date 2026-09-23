import type { AssistantSkillReference, AssistantSkillSummary } from "@skladno/shared";

import type { AssistantSkillPackage } from "./assistant-skill-package.js";


export interface AssistantSkillSource {
    id: string;
    summaries(): readonly AssistantSkillSummary[];
    load(reference: AssistantSkillReference): AssistantSkillPackage | undefined;
}
