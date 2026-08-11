import type { CreateSourceCitationInput, CreateEditorialArtifactInput, SourceCitation, EditorialArtifact } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, now, required, type Row } from "./repository-utils.js";


export class EditorialArtifactsRepository {
    constructor(private readonly database: SqliteDatabase) { }


    create(input: CreateEditorialArtifactInput): EditorialArtifact {
        const id = input.id ?? createId();
        const createdAt = now();
        required(input.kind, "Artifact kind");
        if (!this.database.prepare("SELECT 1 FROM article_revisions WHERE id = ? AND article_id = ?").get(input.revisionId, input.articleId))
            throw new Error("Revision does not belong to this Article.");

        this.database.prepare("INSERT INTO editorial_artifacts (id, article_id, revision_id, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, input.articleId, input.revisionId, input.kind, input.content, createdAt);

        return { id,
            articleId: input.articleId,
            revisionId: input.revisionId,
            kind: input.kind,
            content: input.content,
            createdAt
        };
    }


    list(articleId: string): EditorialArtifact[] {
        return (this.database.prepare("SELECT * FROM editorial_artifacts WHERE article_id = ? ORDER BY created_at ASC, id ASC").all(articleId) as Row[])
            .map((row) => ({
                id: String(row.id),
                articleId: String(row.article_id),
                revisionId: String(row.revision_id),
                kind: String(row.kind),
                content: String(row.content),
                createdAt: String(row.created_at)
            }));
    }


    get(artifactId: string, articleId: string): EditorialArtifact | undefined {
        return this.list(articleId).find((artifact) => artifact.id === artifactId);
    }


    updateContent(artifactId: string, articleId: string, content: string): void {
        if (this.database.prepare("UPDATE editorial_artifacts SET content = ? WHERE id = ? AND article_id = ?").run(content, artifactId, articleId).changes === 0)
            throw new Error("Editorial artifact not found.");
    }


    createCitation(input: CreateSourceCitationInput): SourceCitation {
        const id = input.id ?? createId();
        const createdAt = now();
        const editorialArtifactId = input.editorialArtifactId;
        required(input.url, "Citation URL");
        required(editorialArtifactId ?? "", "Editorial Artifact id");
        this.database.prepare("INSERT INTO source_citations (id, editorial_artifact_id, url, title, excerpt, uncertainty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(id, editorialArtifactId!, input.url, input.title ?? null, input.excerpt ?? null, input.uncertainty ?? null, createdAt);

        return {
            id,
            editorialArtifactId: editorialArtifactId!,
            url: input.url,
            ...(input.title ? { title: input.title } : {}),
            ...(input.excerpt ? { excerpt: input.excerpt } : {}),
            ...(input.uncertainty ? { uncertainty: input.uncertainty } : {}),
            createdAt
        };
    }


    createWithCitations(input: CreateEditorialArtifactInput, citations: Omit<CreateSourceCitationInput, "editorialArtifactId">[]): EditorialArtifact {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const artifact = this.create(input);
            for (const citation of citations)
                this.createCitation({ ...citation, editorialArtifactId: artifact.id });

            this.database.exec("COMMIT;");

            return artifact;
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
    }


    listCitations(editorialArtifactId: string): SourceCitation[] {
        return (this.database.prepare("SELECT * FROM source_citations WHERE editorial_artifact_id = ? ORDER BY created_at ASC, id ASC").all(editorialArtifactId) as Row[])
            .map((row) => ({
                id: String(row.id),
                editorialArtifactId: String(row.editorial_artifact_id),
                url: String(row.url),
                ...(row.title ? { title: String(row.title) } : {}),
                ...(row.excerpt ? { excerpt: String(row.excerpt) } : {}),
                ...(row.uncertainty ? { uncertainty: String(row.uncertainty) } : {}),
                createdAt: String(row.created_at)
            }));
    }
}
