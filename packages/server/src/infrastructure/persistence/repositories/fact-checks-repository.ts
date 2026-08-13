import type { FactCheck } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { now, type Row } from "./repository-utils.js";

export class FactChecksRepository {
    constructor(private readonly database: SqliteDatabase) { }

    
    save(artifactId: string, articleId: string, revisionId: string): void {
        this.database.prepare("INSERT INTO fact_check_runs (editorial_artifact_id, article_id, revision_id, created_at) VALUES (?, ?, ?, ?)")
            .run(artifactId, articleId, revisionId, now());
    }


    list(articleId: string): FactCheck[] {
        return (this.database.prepare("SELECT a.content, r.revision_id, r.created_at FROM fact_check_runs r JOIN editorial_artifacts a ON a.id = r.editorial_artifact_id WHERE r.article_id = ? ORDER BY r.created_at DESC").all(articleId) as Row[])
            .flatMap((row) => {
                try {
                    const factCheck = JSON.parse(String(row.content)) as { factCheck?: FactCheck };
                    return factCheck.factCheck ? [{ ...factCheck.factCheck, reviewedRevisionId: String(row.revision_id), createdAt: String(row.created_at) }] : [];
                } catch {
                    return [];
                }
            })
            .map((check) => ({ ...check, findings: check.findings.map((finding) => {
                const resolution = finding.occurrenceId ? this.resolution(finding.occurrenceId) : undefined;
                return resolution ? { ...finding, resolution } : finding;
            }) }));
    }


    resolve(occurrenceId: string, resolution: "corrected_or_removed" | "accepted_as_written" | "evidence_accepted"): void {
        this.database.prepare("INSERT INTO fact_check_resolutions (occurrence_id, resolution, updated_at) VALUES (?, ?, ?) ON CONFLICT(occurrence_id) DO UPDATE SET resolution = excluded.resolution, updated_at = excluded.updated_at")
            .run(occurrenceId, resolution, now());
    }


    private resolution(occurrenceId: string): "corrected_or_removed" | "accepted_as_written" | "evidence_accepted" | undefined {
        const row = this.database.prepare("SELECT resolution FROM fact_check_resolutions WHERE occurrence_id = ?").get(occurrenceId) as Row | undefined;
        return row?.resolution as "corrected_or_removed" | "accepted_as_written" | "evidence_accepted" | undefined;
    }
}
