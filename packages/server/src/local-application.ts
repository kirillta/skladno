import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createApplicationServices } from "./application/create-application-services.js";
import type { ApplicationServices } from "./application/application-services.js";
import { EditorialService } from "./application/services/editorial/editorial-service.js";
import { loadServerConfig, type ServerConfig } from "./infrastructure/configuration/config.js";
import { readSystemDateTimeFormat } from "./infrastructure/configuration/system-date-time-format.js";
import { AiConnectionModelDiscoveryService } from "./infrastructure/editorial/services/ai-connection-model-discovery-service.js";
import { ConfiguredEditorialEngineResolver } from "./infrastructure/editorial/engines/configured-editorial-engine-resolver.js";
import { SqliteBackupManager } from "./infrastructure/persistence/sqlite-backup-manager.js";
import { WindowsCredentialStore } from "./infrastructure/configuration/windows-credential-store.js";
import { ArticlesRepository, AssistantRepository, EditorialArtifactsRepository, EditorialSessionsRepository, FactChecksRepository, SettingsRepository, StyleCorpusRepository, openDatabase } from "./infrastructure/persistence/index.js";
import type { TelemetryObserver } from "./application/telemetry/telemetry-observer.js";


export interface LocalApplication {
    services: ApplicationServices;
    editorial: EditorialService;
    database: DatabaseSync;
}


export function createLocalApplication(config: ServerConfig = loadServerConfig(), telemetry?: TelemetryObserver): LocalApplication {
    const database = openDatabase(config.databasePath);
    const articles = new ArticlesRepository(database);
    const editorialArtifacts = new EditorialArtifactsRepository(database);
    const factChecks = new FactChecksRepository(database);
    const settings = new SettingsRepository(database);
    const editorialSessions = new EditorialSessionsRepository(database, (articleId) => Boolean(articles.get(articleId)));
    const styleCorpus = new StyleCorpusRepository(database);
    const assistant = new AssistantRepository(database);
    const credentialStore = new WindowsCredentialStore();
    const modelDiscovery = new AiConnectionModelDiscoveryService();
    const engines = new ConfiguredEditorialEngineResolver(config, settings, credentialStore);

    assistant.seedGreetings();

    const editorial = new EditorialService(articles, editorialSessions, styleCorpus, editorialArtifacts, engines, config.aiSessionContinuationEnabled, factChecks, telemetry);
    return {
        services: createApplicationServices({
            articles,
            settings,
            styleCorpus,
            assistant,
            artifacts: editorialArtifacts,
            engines,
            dateTimeFormat: { read: readSystemDateTimeFormat },
            models: {
                list: (connection, apiKey) => modelDiscovery.list(connection, apiKey ?? (connection.credentialSource.kind === "environment-variable"
                    ? process.env[connection.credentialSource.environmentVariableName]
                    : credentialStore.get(connection.id)))
            },
            createConnectionId: randomUUID,
            factChecks,
            backups: new SqliteBackupManager(database),
            credentialStore,
            editorial,
            telemetry,
        }),
        editorial,
        database,
    };
}
