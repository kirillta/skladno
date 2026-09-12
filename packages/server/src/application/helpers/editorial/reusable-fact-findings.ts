import { FACT_CHECK_STATUS, type FactCheckFinding } from "@skladno/shared";

import type { FactCheckHistory } from "../../models/editorial/fact-check-history.js";


export function reusableFactFindings(factChecks: FactCheckHistory, articleId: string): FactCheckFinding[] {
    return factChecks.list(articleId).flatMap((factCheck) => factCheck.findings
        .filter((finding) => finding.status === FACT_CHECK_STATUS.SUPPORTED)
        .map((finding) => ({ ...finding, reusedFromRevisionId: factCheck.reviewedRevisionId })));
}
