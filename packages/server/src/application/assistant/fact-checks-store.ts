import type { FactCheck } from "@skladno/shared";


export interface FactChecksStore {
    listFactChecks(articleId: string): FactCheck[];
    saveFactCheckRun(artifactId: string, articleId: string, revisionId: string, factCheck: FactCheck): void;
}
