import type { FactCheckFinding } from "@skladno/shared";


export interface FactCheckRequest {
    article: string;
    instructions: string;
    reusableFactFindings?: FactCheckFinding[];
    skipFactCheckClaim?: (claim: string) => boolean;
}
