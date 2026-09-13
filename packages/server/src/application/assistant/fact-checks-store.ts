import type { FactCheck } from "@skladno/shared";


export interface FactChecksStore {
    list(articleId: string): FactCheck[];
    save(artifactId: string, articleId: string, revisionId: string): void;
}
