import type { AssistantSkillSummary } from "@skladno/shared";


export interface AssistantSkillPackage extends AssistantSkillSummary {
    instructions: string;
    references?: readonly string[];
    contentHash?: string;
}
