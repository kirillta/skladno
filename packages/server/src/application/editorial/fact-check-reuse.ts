import { FACT_CHECK_STATUS, type FactCheck, type FactCheckFinding } from "@skladno/shared";


export interface FactCheckHistory {
    list(articleId: string): FactCheck[];
}


export function reusableFactFindings(factChecks: FactCheckHistory, articleId: string): FactCheckFinding[] {
    return factChecks.list(articleId).flatMap((factCheck) => factCheck.findings
        .filter((finding) => finding.status === FACT_CHECK_STATUS.SUPPORTED)
        .map((finding) => ({ ...finding, reusedFromRevisionId: factCheck.reviewedRevisionId })));
}
