import type { FactCheckFinding } from "@skladno/shared";

import type { FactCheckHistory } from "./fact-check-history.js";


export function getReusableFactFindings(factChecks: FactCheckHistory, articleId: string): FactCheckFinding[] {
    const latest = new Map<string, FactCheckFinding>();
    for (const check of factChecks.listFactChecks(articleId)) {
        for (const finding of check.findings) {
            if (!finding.factId || latest.has(finding.factId))
                continue;

            latest.set(finding.factId, {
                ...finding,
                reusedFromRevisionId: finding.reusedFromRevisionId ?? check.reviewedRevisionId,
            });
        }
    }

    return [...latest.values()];
}
