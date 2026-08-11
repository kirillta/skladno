import type { ProposalChange, ProposalChangeSummary } from "@skladno/shared";


export interface ProposalSummaryGenerator {
    summarize(changes: ProposalChange[], signal: AbortSignal): Promise<ProposalChangeSummary[]>;
}
