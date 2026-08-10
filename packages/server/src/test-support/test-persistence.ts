import { ArticleService } from "../application/articles/article-service.js";
import { AssistantRepository, ArticlesRepository, EditorialArtifactsRepository, EditorialSessionsRepository, MaterialsRepository, SettingsRepository, StyleCorpusRepository, type SqliteDatabase } from "../infrastructure/persistence/index.js";


export interface TestPersistence {
    articles: ArticlesRepository;
    articleService: ArticleService;
    assistant: AssistantRepository;
    editorialArtifacts: EditorialArtifactsRepository;
    editorialSessions: EditorialSessionsRepository;
    materials: MaterialsRepository;
    settings: SettingsRepository;
    styleCorpus: StyleCorpusRepository;
}


export function createTestPersistence(database: SqliteDatabase): TestPersistence {
    const articles = new ArticlesRepository(database);
    const assistant = new AssistantRepository(database);
    const editorialArtifacts = new EditorialArtifactsRepository(database);
    const editorialSessions = new EditorialSessionsRepository(database, (articleId) => Boolean(articles.get(articleId)));
    const materials = new MaterialsRepository(database);
    const settings = new SettingsRepository(database);
    const styleCorpus = new StyleCorpusRepository(database);
    assistant.seedGreetings();

    return {
        articles,
        articleService: new ArticleService(articles, assistant),
        assistant,
        editorialArtifacts,
        editorialSessions,
        materials,
        settings,
        styleCorpus,
    };
}
