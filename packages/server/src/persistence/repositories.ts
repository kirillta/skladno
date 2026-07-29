import type {
    AcceptedChange,
    AcceptProposalInput,
    AppSetting,
    CreateDocumentInput,
    CreateMaterialInput,
    CreateSourceCitationInput,
    CreateWorkflowArtifactInput,
    Document,
    DocumentVersion,
    EditorialSession,
    Material,
    SaveDocumentDraftInput,
    SourceCitation,
    UpdateMaterialInput,
    WorkflowArtifact,
    CreateStyleCorpusItemInput,
    StyleCorpus,
} from "@skladno/shared";

import type { SqliteDatabase } from "./database.js";
import { DocumentsRepository } from "./repositories/documents-repository.js";
import { EditorialSessionsRepository } from "./repositories/editorial-sessions-repository.js";
import { MaterialsRepository } from "./repositories/materials-repository.js";
import { SettingsRepository } from "./repositories/settings-repository.js";
import { WorkflowArtifactsRepository } from "./repositories/workflow-artifacts-repository.js";
import { StyleCorpusRepository } from "./repositories/style-corpus-repository.js";


/** Compatibility facade for current application services. Domain repositories remain independently usable. */
export class Repositories {
    readonly documents: DocumentsRepository;
    readonly materials: MaterialsRepository;
    readonly workflowArtifacts: WorkflowArtifactsRepository;
    readonly settings: SettingsRepository;
    readonly editorialSessions: EditorialSessionsRepository;
    readonly styleCorpus: StyleCorpusRepository;


    constructor(database: SqliteDatabase) {
        this.documents = new DocumentsRepository(database);
        this.materials = new MaterialsRepository(database);
        this.workflowArtifacts = new WorkflowArtifactsRepository(database);
        this.settings = new SettingsRepository(database);
        this.editorialSessions = new EditorialSessionsRepository(database, (documentId) => Boolean(this.documents.get(documentId)));
        this.styleCorpus = new StyleCorpusRepository(database);
    }


    createMaterial(input: CreateMaterialInput): Material { 
        return this.materials.create(input); 
    }


    getMaterial(materialId: string): Material | undefined { 
        return this.materials.get(materialId); 
    }


    updateMaterial(materialId: string, input: UpdateMaterialInput): Material { 
        return this.materials.update(materialId, input); 
    }


    createDocument(input: CreateDocumentInput): Document { 
        return this.documents.create(input); 
    }


    listDocuments(): Document[] { 
        return this.documents.list(); 
    }


    getDocument(documentId: string): Document | undefined { 
        return this.documents.get(documentId); 
    }


    renameDocument(documentId: string, title: string): Document { 
        return this.documents.rename(documentId, title); 
    }


    deleteDocument(documentId: string): void { 
        this.documents.delete(documentId); 
    }


    listVersions(documentId: string): DocumentVersion[] { 
        return this.documents.listVersions(documentId); 
    }


    acceptChange(documentId: string, change: AcceptedChange): DocumentVersion { 
        return this.documents.acceptChange(documentId, change); 
    }


    acceptProposal(documentId: string, input: AcceptProposalInput): DocumentVersion {
        return this.documents.acceptProposal(documentId, input);
    }


    saveDraft(documentId: string, input: SaveDocumentDraftInput): DocumentVersion { 
        return this.documents.saveDraft(documentId, input); 
    }


    restoreVersion(documentId: string, versionId: string): DocumentVersion { 
        return this.documents.restoreVersion(documentId, versionId); 
    }


    createWorkflowArtifact(input: CreateWorkflowArtifactInput): WorkflowArtifact { 
        return this.workflowArtifacts.create(input); 
    }


    listWorkflowArtifacts(documentId: string): WorkflowArtifact[] { 
        return this.workflowArtifacts.list(documentId); 
    }


    createSourceCitation(input: CreateSourceCitationInput): SourceCitation { 
        return this.workflowArtifacts.createCitation(input); 
    }


    listSourceCitations(artifactId: string): SourceCitation[] { 
        return this.workflowArtifacts.listCitations(artifactId); 
    }


    setSetting(key: string, value: unknown): AppSetting { 
        return this.settings.set(key, value); 
    }


    getSetting(key: string): AppSetting | undefined { 
        return this.settings.get(key); 
    }


    getEditorialSession(documentId: string): EditorialSession | undefined { 
        return this.editorialSessions.get(documentId); 
    }


    saveEditorialSession(documentId: string, responseId: string): EditorialSession { 
        return this.editorialSessions.save(documentId, responseId); 
    }


    removeEditorialSession(documentId: string): void {
        this.editorialSessions.remove(documentId);
    }


    getStyleCorpus(): StyleCorpus {
        return this.styleCorpus.get();
    }


    addStyleCorpusItem(input: CreateStyleCorpusItemInput): StyleCorpus {
        return this.styleCorpus.add(input);
    }


    removeStyleCorpusItem(materialId: string): void {
        this.styleCorpus.remove(materialId);
    }
}
