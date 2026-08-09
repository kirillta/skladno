import type { Article, CreateEditorialArtifactInput, CreateSourceCitationInput, EditorialArtifact, EditorialSession, StyleCorpus } from "@skladno/shared";


export interface EditorialStore {
    getArticle(articleId: string): Article | undefined;
    getEditorialSession(articleId: string): EditorialSession | undefined;
    saveEditorialSession(articleId: string, responseId: string): EditorialSession;
    removeEditorialSession(articleId: string): void;
    getStyleCorpus(): StyleCorpus;
    createEditorialArtifact(input: CreateEditorialArtifactInput): EditorialArtifact;
    createEditorialArtifactWithCitations(input: CreateEditorialArtifactInput, citations: Omit<CreateSourceCitationInput, "editorialArtifactId">[]): EditorialArtifact;
}
