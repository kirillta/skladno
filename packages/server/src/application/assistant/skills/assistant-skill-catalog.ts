import type { AssistantSkillReference, AssistantSkillSummary } from "@skladno/shared";

import { builtInSkillPackages, getBuiltInSkillSummary, type AssistantSkillPackage } from "./built-in-skill-packages.js";


export interface AssistantSkillSource {
    id: string;
    summaries(): readonly AssistantSkillSummary[];
    load(reference: AssistantSkillReference): AssistantSkillPackage | undefined;
}


function areSkillReferencesEqual(left: AssistantSkillReference, right: AssistantSkillReference): boolean {
    return left.source === right.source && left.id === right.id && left.version === right.version;
}


export const builtInSkillSource: AssistantSkillSource = {
    id: "built-in",
    summaries: () => builtInSkillPackages.map(getBuiltInSkillSummary),
    load: (reference) => builtInSkillPackages.find((skillPackage) => areSkillReferencesEqual(skillPackage.reference, reference)),
};


export class AssistantSkillCatalog {
    constructor(private readonly sources: readonly AssistantSkillSource[]) { }


    discover(): AssistantSkillSummary[] {
        return this.sources.flatMap((source) => source.summaries());
    }


    load(references: readonly AssistantSkillReference[]): AssistantSkillPackage[] {
        const loaded: AssistantSkillPackage[] = [];
        for (const reference of references) {
            if (loaded.some((skillPackage) => areSkillReferencesEqual(skillPackage.reference, reference)))
                continue;

            const source = this.sources.find((candidate) => candidate.id === reference.source);
            const skillPackage = source?.load(reference);
            if (skillPackage)
                loaded.push(skillPackage);
        }

        return loaded;
    }
}
