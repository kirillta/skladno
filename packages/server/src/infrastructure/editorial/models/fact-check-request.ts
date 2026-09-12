import type { FactCheckFinding } from "@skladno/shared";


export interface FactCheckRequest {
    article: string;
    reusableFactFindings?: FactCheckFinding[];
}
