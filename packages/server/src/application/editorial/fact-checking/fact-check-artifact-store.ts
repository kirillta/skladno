import type { CreateEditorialArtifactInput, EditorialArtifact } from "@skladno/shared";


export interface FactCheckArtifactStore {
    withinTransaction<T>(run: () => T): T;
    create(input: CreateEditorialArtifactInput): EditorialArtifact;
    createCitation(input: { editorialArtifactId: string; url: string; title?: string; excerpt?: string; uncertainty?: string }): void;
}
