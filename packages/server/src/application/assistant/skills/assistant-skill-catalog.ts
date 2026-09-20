import type { AssistantSkillReference, AssistantSkillSummary } from "@skladno/shared";

import type { AssistantSkillPackage } from "./assistant-skill-package.js";
import type { AssistantSkillSource } from "./assistant-skill-source.js";


function areSkillReferencesEqual(left: AssistantSkillReference, right: AssistantSkillReference): boolean {
    return left.source === right.source && left.id === right.id && left.version === right.version;
}


export class AssistantSkillCatalog {
    constructor(private readonly sources: readonly AssistantSkillSource[]) { }


    discover(): AssistantSkillSummary[] {
        const ids = new Set<string>();
        const names = new Set<string>();
        return this.sources.flatMap((source) => source.summaries()).filter((summary) => {
            const name = summary.name.normalize("NFKC").toLocaleLowerCase();
            if (ids.has(summary.reference.id) || names.has(name))
                return false;

            ids.add(summary.reference.id);
            names.add(name);
            return true;
        });
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
