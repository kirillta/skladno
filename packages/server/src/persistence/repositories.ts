import { randomUUID } from "node:crypto";
import type {
  AcceptedChange, AppSetting, CreateDocumentInput, CreateMaterialInput, CreateSourceCitationInput,
  CreateWorkflowArtifactInput, Document, DocumentVersion, Material, SourceCitation, UpdateMaterialInput,
  WorkflowArtifact,
} from "@skladno/shared";

import type { SqliteDatabase } from "./database.js";

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();
const id = () => randomUUID();
const required = (value: string, name: string) => {
  if (!value.trim()) throw new Error(`${name} must not be empty.`);
  return value;
};
const parseObject = (value: unknown): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(String(value));
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Invalid persisted provenance.");
  return parsed as Record<string, unknown>;
};
function version(row: Row): DocumentVersion {
  return { id: String(row.id), documentId: String(row.document_id), content: String(row.content), createdAt: String(row.created_at), provenance: parseObject(row.provenance_json), ...(row.restored_from_version_id ? { restoredFromVersionId: String(row.restored_from_version_id) } : {}) };
}
function material(row: Row): Material { return { id: String(row.id), name: String(row.name), content: String(row.content), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
function document(row: Row): Document {
  const currentVersion = version(row);
  return { id: String(row.document_id), title: String(row.title), createdAt: String(row.document_created_at), updatedAt: String(row.document_updated_at), currentVersionId: currentVersion.id, currentVersion };
}

export class Repositories {
  constructor(private readonly database: SqliteDatabase) {}

  createMaterial(input: CreateMaterialInput): Material {
    const timestamp = now(); const materialId = input.id ?? id();
    this.database.prepare("INSERT INTO materials (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(materialId, required(input.name, "Material name"), input.content, timestamp, timestamp);
    return this.getMaterial(materialId)!;
  }
  getMaterial(materialId: string): Material | undefined { const row = this.database.prepare("SELECT * FROM materials WHERE id = ?").get(materialId) as Row | undefined; return row && material(row); }
  updateMaterial(materialId: string, input: UpdateMaterialInput): Material {
    const existing = this.getMaterial(materialId); if (!existing) throw new Error("Material not found.");
    if (input.name === undefined && input.content === undefined) return existing;
    this.database.prepare("UPDATE materials SET name = ?, content = ?, updated_at = ? WHERE id = ?")
      .run(input.name === undefined ? existing.name : required(input.name, "Material name"), input.content ?? existing.content, now(), materialId);
    return this.getMaterial(materialId)!;
  }

  createDocument(input: CreateDocumentInput): Document {
    const timestamp = now(), documentId = input.id ?? id(), versionId = id();
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      this.database.prepare("INSERT INTO documents (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(documentId, required(input.title, "Document title"), timestamp, timestamp);
      this.database.prepare("INSERT INTO document_versions (id, document_id, content, provenance_json, created_at) VALUES (?, ?, ?, ?, ?)").run(versionId, documentId, input.content, JSON.stringify(input.provenance ?? { kind: "initial" }), timestamp);
      this.database.prepare("UPDATE documents SET current_version_id = ? WHERE id = ?").run(versionId, documentId);
      this.database.exec("COMMIT;");
    } catch (error) { this.database.exec("ROLLBACK;"); throw error; }
    return this.getDocument(documentId)!;
  }
  listDocuments(): Document[] { return (this.database.prepare(`SELECT d.id document_id, d.title, d.created_at document_created_at, d.updated_at document_updated_at, v.* FROM documents d JOIN document_versions v ON v.id = d.current_version_id ORDER BY d.updated_at DESC, d.id ASC`).all() as Row[]).map(document); }
  getDocument(documentId: string): Document | undefined { const row = this.database.prepare(`SELECT d.id document_id, d.title, d.created_at document_created_at, d.updated_at document_updated_at, v.* FROM documents d JOIN document_versions v ON v.id = d.current_version_id WHERE d.id = ?`).get(documentId) as Row | undefined; return row && document(row); }
  listVersions(documentId: string): DocumentVersion[] { return (this.database.prepare("SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at ASC, id ASC").all(documentId) as Row[]).map(version); }
  acceptChange(documentId: string, change: AcceptedChange): DocumentVersion {
    return this.appendVersion(documentId, change.content, change.provenance);
  }
  private appendVersion(documentId: string, content: string, provenance: Record<string, unknown>, restoredFromVersionId?: string): DocumentVersion {
    if (!this.getDocument(documentId)) throw new Error("Document not found.");
    const versionId = id(), timestamp = now(); required(JSON.stringify(provenance), "Change provenance");
    this.database.exec("BEGIN IMMEDIATE;");
    try { this.database.prepare("INSERT INTO document_versions (id, document_id, content, provenance_json, restored_from_version_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(versionId, documentId, content, JSON.stringify(provenance), restoredFromVersionId ?? null, timestamp); this.database.prepare("UPDATE documents SET current_version_id = ?, updated_at = ? WHERE id = ?").run(versionId, timestamp, documentId); this.database.exec("COMMIT;"); } catch (error) { this.database.exec("ROLLBACK;"); throw error; }
    return this.listVersions(documentId).find((item) => item.id === versionId)!;
  }
  restoreVersion(documentId: string, historicalVersionId: string): DocumentVersion {
    const historical = this.database.prepare("SELECT * FROM document_versions WHERE id = ? AND document_id = ?").get(historicalVersionId, documentId) as Row | undefined;
    if (!historical) throw new Error("Version not found for this document.");
    return this.appendVersion(documentId, String(historical.content), { kind: "restore", restoredFromVersionId: historicalVersionId }, historicalVersionId);
  }

  createWorkflowArtifact(input: CreateWorkflowArtifactInput): WorkflowArtifact {
    const artifactId = input.id ?? id(), timestamp = now(); required(input.kind, "Artifact kind");
    this.database.prepare("INSERT INTO workflow_artifacts (id, document_id, version_id, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(artifactId, input.documentId, input.versionId, input.kind, input.content, timestamp);
    return { id: artifactId, documentId: input.documentId, versionId: input.versionId, kind: input.kind, content: input.content, createdAt: timestamp };
  }
  listWorkflowArtifacts(documentId: string): WorkflowArtifact[] {
    return (this.database.prepare("SELECT * FROM workflow_artifacts WHERE document_id = ? ORDER BY created_at ASC, id ASC").all(documentId) as Row[])
      .map((row) => ({ id: String(row.id), documentId: String(row.document_id), versionId: String(row.version_id), kind: String(row.kind), content: String(row.content), createdAt: String(row.created_at) }));
  }
  createSourceCitation(input: CreateSourceCitationInput): SourceCitation {
    const citationId = input.id ?? id(), timestamp = now(); required(input.url, "Citation URL");
    this.database.prepare("INSERT INTO source_citations (id, artifact_id, url, title, excerpt, uncertainty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(citationId, input.artifactId, input.url, input.title ?? null, input.excerpt ?? null, input.uncertainty ?? null, timestamp);
    return { id: citationId, artifactId: input.artifactId, url: input.url, ...(input.title ? { title: input.title } : {}), ...(input.excerpt ? { excerpt: input.excerpt } : {}), ...(input.uncertainty ? { uncertainty: input.uncertainty } : {}), createdAt: timestamp };
  }
  listSourceCitations(artifactId: string): SourceCitation[] {
    return (this.database.prepare("SELECT * FROM source_citations WHERE artifact_id = ? ORDER BY created_at ASC, id ASC").all(artifactId) as Row[])
      .map((row) => ({ id: String(row.id), artifactId: String(row.artifact_id), url: String(row.url), ...(row.title ? { title: String(row.title) } : {}), ...(row.excerpt ? { excerpt: String(row.excerpt) } : {}), ...(row.uncertainty ? { uncertainty: String(row.uncertainty) } : {}), createdAt: String(row.created_at) }));
  }
  setSetting(key: string, value: unknown): AppSetting { required(key, "Setting key"); const updatedAt = now(); this.database.prepare("INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at").run(key, JSON.stringify(value), updatedAt); return { key, value, updatedAt }; }
  getSetting(key: string): AppSetting | undefined { const row = this.database.prepare("SELECT * FROM app_settings WHERE key = ?").get(key) as Row | undefined; return row && { key: String(row.key), value: JSON.parse(String(row.value_json)), updatedAt: String(row.updated_at) }; }
}
