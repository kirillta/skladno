import type {
    AcceptedChange,
    AcceptProposalInput,
    AppSetting,
    CreateArticleInput,
    CreateMaterialInput,
    CreateSourceCitationInput,
    CreateEditorialArtifactInput,
    Article,
    ArticleRevision,
    EditorialSession,
    Material,
    SaveArticleRevisionInput,
    SourceCitation,
    UpdateMaterialInput,
    EditorialArtifact,
    CreateStyleCorpusItemInput,
    StyleCorpus,
} from "@skladno/shared";

import type { SqliteDatabase } from "./database.js";
import { ArticlesRepository } from "./repositories/articles-repository.js";
import { EditorialSessionsRepository } from "./repositories/editorial-sessions-repository.js";
import { MaterialsRepository } from "./repositories/materials-repository.js";
import { SettingsRepository } from "./repositories/settings-repository.js";
import { EditorialArtifactsRepository } from "./repositories/workflow-artifacts-repository.js";
import { StyleCorpusRepository } from "./repositories/style-corpus-repository.js";


/** Compatibility facade for current application services. Domain repositories remain independently usable. */
export class Repositories {
    readonly articles: ArticlesRepository;
    readonly materials: MaterialsRepository;
    readonly editorialArtifacts: EditorialArtifactsRepository;
    readonly settings: SettingsRepository;
    readonly editorialSessions: EditorialSessionsRepository;
    readonly styleCorpus: StyleCorpusRepository;


    constructor(database: SqliteDatabase) {
        this.articles = new ArticlesRepository(database);
        this.materials = new MaterialsRepository(database);
        this.editorialArtifacts = new EditorialArtifactsRepository(database);
        this.settings = new SettingsRepository(database);
        this.editorialSessions = new EditorialSessionsRepository(database, (articleId) => Boolean(this.articles.get(articleId)));
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


    createArticle(input: CreateArticleInput): Article { 
        return this.articles.create(input); 
    }


    listArticles(): Article[] { 
        return this.articles.list(); 
    }


    getArticle(articleId: string): Article | undefined { 
        return this.articles.get(articleId); 
    }


    renameArticle(articleId: string, title: string): Article { 
        return this.articles.rename(articleId, title); 
    }


    deleteArticle(articleId: string): void { 
        this.articles.delete(articleId); 
    }


    listArticleRevisions(articleId: string): ArticleRevision[] { 
        return this.articles.listRevisions(articleId); 
    }


    acceptChange(articleId: string, change: AcceptedChange): ArticleRevision { 
        return this.articles.acceptChange(articleId, change); 
    }


    acceptProposal(articleId: string, input: AcceptProposalInput): ArticleRevision {
        return this.articles.acceptProposal(articleId, input);
    }


    saveArticleRevision(articleId: string, input: SaveArticleRevisionInput): ArticleRevision { 
        return this.articles.saveRevision(articleId, input); 
    }


    restoreRevision(articleId: string, revisionId: string): ArticleRevision { 
        return this.articles.restoreRevision(articleId, revisionId); 
    }


    createEditorialArtifact(input: CreateEditorialArtifactInput): EditorialArtifact { 
        return this.editorialArtifacts.create(input); 
    }


    createEditorialArtifactWithCitations(input: CreateEditorialArtifactInput, citations: Omit<CreateSourceCitationInput, "editorialArtifactId">[]): EditorialArtifact {
        return this.editorialArtifacts.createWithCitations(input, citations);
    }


    listEditorialArtifacts(articleId: string): EditorialArtifact[] { 
        return this.editorialArtifacts.list(articleId); 
    }


    createSourceCitation(input: CreateSourceCitationInput): SourceCitation { 
        return this.editorialArtifacts.createCitation(input); 
    }


    listSourceCitations(editorialArtifactId: string): SourceCitation[] { 
        return this.editorialArtifacts.listCitations(editorialArtifactId); 
    }


    setSetting(key: string, value: unknown): AppSetting { 
        return this.settings.set(key, value); 
    }


    getSetting(key: string): AppSetting | undefined { 
        return this.settings.get(key); 
    }


    getEditorialSession(articleId: string): EditorialSession | undefined { 
        return this.editorialSessions.get(articleId); 
    }


    saveEditorialSession(articleId: string, responseId: string): EditorialSession { 
        return this.editorialSessions.save(articleId, responseId); 
    }


    removeEditorialSession(articleId: string): void {
        this.editorialSessions.remove(articleId);
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
