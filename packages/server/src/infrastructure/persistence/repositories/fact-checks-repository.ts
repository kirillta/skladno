import type { FactCheck } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { getCurrentTimestamp, type Row } from "./repository-utils.js";


export class FactChecksRepository {
    constructor(private readonly database: SqliteDatabase) { }


    saveFactCheckRun(artifactId: string, articleId: string, revisionId: string, factCheck: FactCheck): void {
        this.database.prepare("INSERT INTO fact_check_runs (editorial_artifact_id, article_id, revision_id, created_at) VALUES (?, ?, ?, ?)")
            .run(artifactId, articleId, revisionId, getCurrentTimestamp());
        const saveFact = this.database.prepare("INSERT INTO facts (id, article_id, first_claim, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING");
        const saveOccurrence = this.database.prepare("INSERT INTO fact_occurrences (id, fact_id, editorial_artifact_id, revision_id, claim, checked_at, reused_from_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
        for (const finding of factCheck.findings) {
            if (!finding.factId || !finding.occurrenceId || !finding.checkedAt)
                continue;

            saveFact.run(finding.factId, articleId, finding.claim, finding.checkedAt);
            saveOccurrence.run(finding.occurrenceId, finding.factId, artifactId, revisionId, finding.claim, finding.checkedAt, finding.reusedFromRevisionId ?? null);
        }
    }


    listFactChecks(articleId: string): FactCheck[] {
        return (this.database.prepare("SELECT a.content, r.revision_id, r.created_at FROM fact_check_runs r JOIN editorial_artifacts a ON a.id = r.editorial_artifact_id WHERE r.article_id = ? AND a.rejected_at IS NULL ORDER BY r.created_at DESC, r.rowid DESC").all(articleId) as Row[])
            .flatMap((row) => {
                try {
                    const factCheck = JSON.parse(String(row.content)) as { factCheck?: FactCheck };
                    return factCheck.factCheck ? [{ ...factCheck.factCheck, reviewedRevisionId: String(row.revision_id), createdAt: String(row.created_at) }] : [];
                } catch {
                    return [];
                }
            })
            .map((check) => ({ ...check, findings: check.findings.map((finding) => {
                const resolution = finding.occurrenceId ? this.getFindingResolution(finding.occurrenceId) : undefined;
                return resolution ? { ...finding, resolution } : finding;
            }) }));
    }


    resolveFactCheckFinding(occurrenceId: string, resolution: "corrected_or_removed" | "accepted_as_written" | "evidence_accepted"): void {
        this.database.prepare("INSERT INTO fact_check_resolutions (occurrence_id, resolution, updated_at) VALUES (?, ?, ?) ON CONFLICT(occurrence_id) DO UPDATE SET resolution = excluded.resolution, updated_at = excluded.updated_at")
            .run(occurrenceId, resolution, getCurrentTimestamp());
    }


    private getFindingResolution(occurrenceId: string): "corrected_or_removed" | "accepted_as_written" | "evidence_accepted" | undefined {
        const row = this.database.prepare("SELECT resolution FROM fact_check_resolutions WHERE occurrence_id = ?").get(occurrenceId) as Row | undefined;
        return row?.resolution as "corrected_or_removed" | "accepted_as_written" | "evidence_accepted" | undefined;
    }
}
