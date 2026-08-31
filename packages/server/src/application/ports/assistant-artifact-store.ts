import type { CreateEditorialArtifactInput, EditorialArtifact } from "@skladno/shared";


export interface AssistantArtifactStore {
    create(input: CreateEditorialArtifactInput): EditorialArtifact;
    list(articleId: string): EditorialArtifact[];
    get(artifactId: string, articleId: string): EditorialArtifact | undefined;
    updateContent(artifactId: string, articleId: string, content: string): void;
}
