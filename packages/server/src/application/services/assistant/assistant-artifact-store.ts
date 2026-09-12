import type { CreateEditorialArtifactInput, CreateSourceCitationInput, EditorialArtifact, SourceCitation } from "@skladno/shared";


export interface AssistantArtifactStore {
    withinTransaction<T>(run: () => T): T;
    create(input: CreateEditorialArtifactInput): EditorialArtifact;
    createCitation(input: CreateSourceCitationInput): SourceCitation;
    list(articleId: string): EditorialArtifact[];
    get(artifactId: string, articleId: string): EditorialArtifact | undefined;
    updateContent(artifactId: string, articleId: string, content: string): void;
}
