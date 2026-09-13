import type { CreateEditorialArtifactInput, CreateSourceCitationInput, EditorialArtifact, SourceCitation } from "@skladno/shared";


export interface AssistantArtifactStore {
    runWithinTransaction<T>(run: () => T): T;
    createEditorialArtifact(input: CreateEditorialArtifactInput): EditorialArtifact;
    createSourceCitation(input: CreateSourceCitationInput): SourceCitation;
    listEditorialArtifacts(articleId: string): EditorialArtifact[];
    getEditorialArtifact(artifactId: string, articleId: string): EditorialArtifact | undefined;
    updateEditorialArtifactContent(artifactId: string, articleId: string, content: string): void;
}
