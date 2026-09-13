import type { FactCheck } from "@skladno/shared";


export class FactCheckService {
    constructor(private readonly checks: {
        listFactChecks(articleId: string): FactCheck[];
        resolveFactCheckFinding(occurrenceId: string, resolution: "corrected_or_removed" | "accepted_as_written" | "evidence_accepted"): void
    }) { }


    list(articleId: string): FactCheck[] {
        return this.checks.listFactChecks(articleId);
    }


    resolve(occurrenceId: string, resolution: "corrected_or_removed" | "accepted_as_written" | "evidence_accepted"): void {
        this.checks.resolveFactCheckFinding(occurrenceId, resolution);
    }
}
