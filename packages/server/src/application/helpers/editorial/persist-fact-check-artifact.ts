import { createHash } from "node:crypto";

import type { FactCheck } from "@skladno/shared";

import type { FactCheckArtifactStore } from "../../models/editorial/fact-check-artifact-store.js";
import type { FactCheckRunStore } from "../../models/editorial/fact-check-run-store.js";


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
            const factId = createHash("sha256").update(finding.claim.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 16);
            return { ...finding, factId, occurrenceId: `${input.revisionId}:${factId}`, checkedAt };
        }),
    };

    const artifact = input.artifacts.withinTransaction(() => {
        const created = input.artifacts.create({
            articleId: input.articleId,
            revisionId: input.revisionId,
            kind: "fact-check",
            content: JSON.stringify({ ...input.metadata, factCheck }),
        });

        for (const finding of factCheck.findings) {
            for (const source of finding.sources) {
                input.artifacts.createCitation({
                    editorialArtifactId: created.id,
                    url: source.url,
                    ...(source.title ? { title: source.title } : {}),
                    ...(source.excerpt ? { excerpt: source.excerpt } : {}),
                    uncertainty: `${source.quality}${source.publishedAt ? `; published ${source.publishedAt}` : ""}; ${finding.uncertainty}`,
                });
            }
        }

        input.factChecks.save(created.id, input.articleId, input.revisionId);
        return created;
    });

    return { artifactId: artifact.id, factCheck };
}
