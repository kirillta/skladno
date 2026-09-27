import { randomUUID } from "node:crypto";

import type { FactCheck } from "@skladno/shared";

import type { FactCheckArtifactStore } from "./fact-check-artifact-store.js";
import type { FactCheckRunStore } from "./fact-check-run-store.js";


export function persistFactCheckArtifact(input: {
    artifacts: FactCheckArtifactStore;
    factChecks: FactCheckRunStore;
    articleId: string;
    revisionId: string;
    metadata: Readonly<Record<string, unknown>>;
    factCheck: FactCheck;
}): { artifactId: string; factCheck: FactCheck } {
    const checkedAt = new Date().toISOString();
    const factCheck: FactCheck = {
        ...input.factCheck,
        reviewedRevisionId: input.revisionId,
        createdAt: checkedAt,
        findings: input.factCheck.findings.map((finding) => {
            // Legacy claim hashes were shared across Articles; only locally assigned UUIDs are durable identities.
            const factId = finding.factId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(finding.factId) ? finding.factId : randomUUID();
            return {
                ...finding,
                factId,
                occurrenceId: randomUUID(),
                checkedAt: finding.checkedAt ?? checkedAt,
                ...(finding.reusedFromRevisionId && finding.resolution && finding.resolution !== "corrected_or_removed"
                    ? { resolution: finding.resolution } : { resolution: undefined }),
            };
        }),
    };

    const artifact = input.artifacts.runWithinTransaction(() => {
        const created = input.artifacts.createEditorialArtifact({
            articleId: input.articleId,
            revisionId: input.revisionId,
            kind: "fact-check",
            content: JSON.stringify({ ...input.metadata, factCheck }),
        });

        for (const finding of factCheck.findings) {
            for (const source of finding.sources) {
                input.artifacts.createSourceCitation({
                    editorialArtifactId: created.id,
                    url: source.url,
                    ...(source.title ? { title: source.title } : {}),
                    ...(source.excerpt ? { excerpt: source.excerpt } : {}),
                    uncertainty: `${source.quality}${source.publishedAt ? `; published ${source.publishedAt}` : ""}; ${finding.uncertainty}`,
                });
            }
        }

        input.factChecks.saveFactCheckRun(created.id, input.articleId, input.revisionId, factCheck);
        return created;
    });

    return { artifactId: artifact.id, factCheck };
}
