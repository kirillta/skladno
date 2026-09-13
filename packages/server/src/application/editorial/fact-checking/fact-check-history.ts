import type { FactCheck } from "@skladno/shared";


export interface FactCheckHistory {
    listFactChecks(articleId: string): FactCheck[];
}
