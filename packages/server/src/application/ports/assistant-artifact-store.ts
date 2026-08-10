import type { CreateEditorialArtifactInput, EditorialArtifact } from "@skladno/shared";


export interface AssistantArtifactStore {
    create(input: CreateEditorialArtifactInput): EditorialArtifact;
}
