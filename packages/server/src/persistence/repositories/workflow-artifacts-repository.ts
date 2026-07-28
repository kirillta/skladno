import type { CreateSourceCitationInput, CreateWorkflowArtifactInput, SourceCitation, WorkflowArtifact } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, now, required, type Row } from "./repository-utils.js";


export class WorkflowArtifactsRepository {
    constructor(private readonly database: SqliteDatabase) { }


    create(input: CreateWorkflowArtifactInput): WorkflowArtifact {
        const id = input.id ?? createId();
        const createdAt = now();
        required(input.kind, "Artifact kind");
        this.database.prepare("INSERT INTO workflow_artifacts (id, document_id, version_id, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, input.documentId, input.versionId, input.kind, input.content, createdAt);

        return { id, documentId: input.documentId, versionId: input.versionId, kind: input.kind, content: input.content, createdAt };
    }


    list(documentId: string): WorkflowArtifact[] {
        return (this.database.prepare("SELECT * FROM workflow_artifacts WHERE document_id = ? ORDER BY created_at ASC, id ASC").all(documentId) as Row[])
            .map((row) => ({ 
                id: String(row.id), 
                documentId: String(row.document_id), 
                versionId: String(row.version_id), 
                kind: String(row.kind), 
                content: String(row.content), 
                createdAt: String(row.created_at) 
            }));
    }


    createCitation(input: CreateSourceCitationInput): SourceCitation {
        const id = input.id ?? createId();
        const createdAt = now();
        required(input.url, "Citation URL");
        this.database.prepare("INSERT INTO source_citations (id, artifact_id, url, title, excerpt, uncertainty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(id, input.artifactId, input.url, input.title ?? null, input.excerpt ?? null, input.uncertainty ?? null, createdAt);
        
        return { 
            id, 
            artifactId: input.artifactId, 
            url: input.url, 
            ...(input.title ? { title: input.title } : {}), 
            ...(input.excerpt ? { excerpt: input.excerpt } : {}), 
            ...(input.uncertainty ? { uncertainty: input.uncertainty } : {}), 
            createdAt 
        };
    }


    listCitations(artifactId: string): SourceCitation[] {
        return (this.database.prepare("SELECT * FROM source_citations WHERE artifact_id = ? ORDER BY created_at ASC, id ASC").all(artifactId) as Row[])
            .map((row) => ({ 
                id: String(row.id), 
                artifactId: String(row.artifact_id), 
                url: String(row.url), 
                ...(row.title ? { title: String(row.title) } : {}), 
                ...(row.excerpt ? { excerpt: String(row.excerpt) } : {}), 
                ...(row.uncertainty ? { uncertainty: String(row.uncertainty) } : {}), 
                createdAt: String(row.created_at) 
            }));
    }
}
