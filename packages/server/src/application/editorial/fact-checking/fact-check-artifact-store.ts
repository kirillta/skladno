import type { CreateEditorialArtifactInput, EditorialArtifact } from "@skladno/shared";


export interface FactCheckArtifactStore {
    withinTransaction<T>(run: () => T): T;
    createEditorialArtifact(input: CreateEditorialArtifactInput): EditorialArtifact;
    createSourceCitation(input: { editorialArtifactId: string; url: string; title?: string; excerpt?: string; uncertainty?: string }): void;
}
