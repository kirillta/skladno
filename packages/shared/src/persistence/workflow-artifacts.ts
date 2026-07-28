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
