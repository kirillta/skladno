/** Transport-neutral records for author-owned local persistence. */
export interface Material {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialInput {
  id?: string;
  name: string;
  content: string;
}

export interface UpdateMaterialInput {
  name?: string;
  content?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  content: string;
  createdAt: string;
  provenance: Record<string, unknown>;
  restoredFromVersionId?: string;
}

export interface Document {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentVersionId: string;
  currentVersion: DocumentVersion;
}

export interface CreateDocumentInput {
  id?: string;
  title: string;
  content: string;
  provenance?: Record<string, unknown>;
}

export interface AcceptedChange {
  content: string;
  provenance: Record<string, unknown>;
}

export interface WorkflowArtifact {
  id: string;
  documentId: string;
  versionId: string;
  kind: string;
  content: string;
  createdAt: string;
}

export interface CreateWorkflowArtifactInput {
  id?: string;
  documentId: string;
  versionId: string;
  kind: string;
  content: string;
}

export interface SourceCitation {
  id: string;
  artifactId: string;
  url: string;
  title?: string;
  excerpt?: string;
  uncertainty?: string;
  createdAt: string;
}

export interface CreateSourceCitationInput {
  id?: string;
  artifactId: string;
  url: string;
  title?: string;
  excerpt?: string;
  uncertainty?: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}
