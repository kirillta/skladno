import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createApplicationServices } from "./application/create-application-services.js";
import type { ApplicationServices } from "./application/application-services.js";
import { EditorialService } from "./application/editorial/editorial-service.js";
import { loadServerConfig, type ServerConfig } from "./infrastructure/configuration/config.js";
import { readSystemDateTimeFormat } from "./infrastructure/configuration/system-date-time-format.js";
import { listAvailableModels } from "./infrastructure/editorial/available-models.js";
import { ConfiguredEditorialEngineResolver } from "./infrastructure/editorial/configured-editorial-engine-resolver.js";
import { SqliteBackupManager } from "./infrastructure/persistence/sqlite-backup-manager.js";
import { WindowsManagedCredentials } from "./infrastructure/configuration/windows-managed-credentials.js";
import { ArticlesRepository, AssistantRepository, EditorialArtifactsRepository, EditorialSessionsRepository, FactChecksRepository, SettingsRepository, StyleCorpusRepository, openDatabase } from "./infrastructure/persistence/index.js";


export interface LocalApplication {
    services: ApplicationServices;
    editorial: EditorialService;
    database: DatabaseSync;
}


export function createLocalApplication(config: ServerConfig = loadServerConfig()): LocalApplication {
    const database = openDatabase(config.databasePath);
    const articles = new ArticlesRepository(database);
    const editorialArtifacts = new EditorialArtifactsRepository(database);
    const factChecks = new FactChecksRepository(database);
    const settings = new SettingsRepository(database);
    const editorialSessions = new EditorialSessionsRepository(database, (articleId) => Boolean(articles.get(articleId)));
    const styleCorpus = new StyleCorpusRepository(database);
    const assistant = new AssistantRepository(database);
    const credentials = new WindowsManagedCredentials();
    const engines = new ConfiguredEditorialEngineResolver(config, settings, credentials);

    assistant.seedGreetings();

    const editorial = new EditorialService(articles, editorialSessions, styleCorpus, editorialArtifacts, engines, config.aiSessionContinuationEnabled, factChecks);
    return {
        services: createApplicationServices(articles, settings, styleCorpus, assistant, editorialArtifacts, engines, { read: readSystemDateTimeFormat }, { list: (connection, apiKey) => listAvailableModels(connection, apiKey ?? (connection.credentialSource.kind === "environment-variable" ? process.env[connection.credentialSource.environmentVariableName] : credentials.get(connection.id))) }, randomUUID, factChecks, new SqliteBackupManager(database), credentials, editorial),
        editorial,
        database,
    };
}
