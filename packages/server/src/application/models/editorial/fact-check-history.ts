import type { FactCheck } from "@skladno/shared";


export interface FactCheckHistory {
    list(articleId: string): FactCheck[];
}
