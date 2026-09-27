import type { FactCheck } from "@skladno/shared";


export interface FactCheckRunStore {
    saveFactCheckRun(artifactId: string, articleId: string, revisionId: string, factCheck: FactCheck): void;
}
