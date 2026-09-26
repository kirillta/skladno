import { APPLICATION_ERROR, FACT_CHECK_STATUS, HTTP_STATUS, type FactCheck } from "@skladno/shared";
import { ApplicationServiceError } from "../../errors/application-service-error.js";


export function verifyCorrectionSelection(checks: FactCheck[], revisionId: string, findingIds: string[]): FactCheck["findings"] {
    const selected = new Set(findingIds);
    if (selected.size === 0 || selected.size !== findingIds.length || findingIds.some((id) => !id.trim()))
        throw new ApplicationServiceError(APPLICATION_ERROR.FACT_CORRECTION_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);

    const findings = (checks.find((check) => check.reviewedRevisionId === revisionId)?.findings ?? [])
        .filter((finding) => finding.occurrenceId && selected.has(finding.occurrenceId));

    if (findings.length !== selected.size || findings.some((finding) => finding.resolution || (finding.status !== FACT_CHECK_STATUS.DISPUTED && finding.status !== FACT_CHECK_STATUS.UNVERIFIABLE)))
        throw new ApplicationServiceError(APPLICATION_ERROR.FACT_CORRECTION_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);

    return findings;
}


export function correctionContext(findings: FactCheck["findings"]): string {
    return `Prepare a correction Proposal only for these explicitly selected advisory Findings. Preserve unrelated claims, numbers, URLs, code, technical terms, and author voice. Findings:\n${findings.map((finding) => `- ${finding.claim}: ${finding.rationale} Sources: ${finding.sources.map((source) => source.url).join(", ")}`).join("\n")}`;
}
