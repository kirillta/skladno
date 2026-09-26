import { FactCheckResearch } from "./fact-check-research.js";
import { FactCheckFindingDraft } from "./fact-check-finding-draft.js";


export interface FactCheckProvider {
    researchStage: string;
    extractClaims(article: string, instructions: string, signal: AbortSignal): Promise<{ responseId: string; claims: { claim: string; }[]; }>;
    matchClaims?(claims: string[], candidates: { factId: string; claim: string }[], signal: AbortSignal): Promise<{ claimIndex: number; factId: string }[]>;
    researchClaims(claims: { claim: string; }[], instructions: string, signal: AbortSignal): Promise<FactCheckResearch[]>;
    evaluateClaims(research: FactCheckResearch[], instructions: string, signal: AbortSignal): Promise<{ responseId: string; findings: FactCheckFindingDraft[]; }>;
}
