export interface EditorialArtifact {
    id: string;
    articleId: string;
    revisionId: string;
    kind: string;
    content: string;
    createdAt: string;
}


export interface CreateEditorialArtifactInput {
    id?: string;
    articleId: string;
    revisionId: string;
    kind: string;
    content: string;
}
