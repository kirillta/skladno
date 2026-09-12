import { FactCheckResearch } from "./fact-check-research.js";
import { FactCheckFindingDraft } from "./fact-check-finding-draft.js";


export interface FactCheckProvider {
    researchStage: string;
    extractClaims(article: string, signal: AbortSignal): Promise<{ responseId: string; claims: { claim: string; }[]; }>;
    researchClaims(claims: { claim: string; }[], signal: AbortSignal): Promise<FactCheckResearch[]>;
    evaluateClaims(research: FactCheckResearch[], signal: AbortSignal): Promise<{ responseId: string; findings: FactCheckFindingDraft[]; }>;
}
