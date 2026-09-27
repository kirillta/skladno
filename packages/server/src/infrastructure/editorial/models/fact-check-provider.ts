import { FactCheckResearch } from "./fact-check-research.js";
import { FactCheckFindingDraft } from "./fact-check-finding-draft.js";
import type { FactCheckFinding } from "@skladno/shared";


export interface FactCheckProvider {
    researchStage: string;
    extractClaims(article: string, instructions: string, signal: AbortSignal, previousFindings?: FactCheckFinding[]): Promise<{ responseId: string; claims: { claim: string; }[]; }>;
    matchClaims?(claims: string[], candidates: { factId: string; claim: string }[], signal: AbortSignal): Promise<{ claimIndex: number; factId: string }[]>;
    researchClaims(claims: { claim: string; }[], instructions: string, signal: AbortSignal): Promise<FactCheckResearch[]>;
    evaluateClaims(research: FactCheckResearch[], instructions: string, signal: AbortSignal): Promise<{ responseId: string; findings: FactCheckFindingDraft[]; }>;
}
