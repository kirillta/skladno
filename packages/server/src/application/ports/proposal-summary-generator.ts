import type { ProposalChange, ProposalChangeSummary } from "@skladno/shared";


export interface ProposalSummaryGenerator {
    summarize(changes: ProposalChange[], interfaceLocale: string, signal: AbortSignal): Promise<ProposalChangeSummary[]>;
}
