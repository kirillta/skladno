import type { FactCheck } from "@skladno/shared";

export class FactCheckService {
    constructor(private readonly checks: { 
        list(articleId: string): FactCheck[]; 
        resolve(occurrenceId: string, resolution: "corrected_or_removed" | "accepted_as_written" | "evidence_accepted"): void 
    }) { }


    list(articleId: string): FactCheck[] {
        return this.checks.list(articleId);
    }

    
    resolve(occurrenceId: string, resolution: "corrected_or_removed" | "accepted_as_written" | "evidence_accepted"): void {
        this.checks.resolve(occurrenceId, resolution);
    }
}
