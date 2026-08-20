import { randomUUID } from "node:crypto";
import { createApplicationServices } from "./application/create-application-services.js";
import { EditorialService } from "./application/editorial/editorial-service.js";
import { loadServerConfig, loadServerEnvironment } from "./infrastructure/configuration/config.js";
import { createLocalDiagnostics } from "./infrastructure/diagnostics/local-diagnostics.js";
import { ConfiguredEditorialEngineResolver } from "./infrastructure/editorial/configured-editorial-engine-resolver.js";
import { listAvailableModels } from "./infrastructure/editorial/available-models.js";
import { closeLocalService, listenForLocalService } from "./infrastructure/lifecycle/service-lifecycle.js";
import { SqliteBackupManager } from "./infrastructure/persistence/sqlite-backup-manager.js";
import { ArticlesRepository, AssistantRepository, EditorialArtifactsRepository, EditorialSessionsRepository, FactChecksRepository, SettingsRepository, StyleCorpusRepository, openDatabase } from "./infrastructure/persistence/index.js";
import { readSystemDateTimeFormat } from "./infrastructure/configuration/system-date-time-format.js";
import { createLocalService } from "./presentation/server.js";

const diagnostics = createLocalDiagnostics();


async function start(): Promise<void> {
    try {
        loadServerEnvironment();

        const config = loadServerConfig();
        const database = openDatabase(config.databasePath);
        const articles = new ArticlesRepository(database);
        const editorialArtifacts = new EditorialArtifactsRepository(database);
        const factChecks = new FactChecksRepository(database);
        const settings = new SettingsRepository(database);
        const editorialSessions = new EditorialSessionsRepository(database, (articleId) => Boolean(articles.get(articleId)));
        const styleCorpus = new StyleCorpusRepository(database);
        const assistant = new AssistantRepository(database);
        const engines = new ConfiguredEditorialEngineResolver(config, settings);

        assistant.seedGreetings();
        const services = createApplicationServices(articles, settings, styleCorpus, assistant, editorialArtifacts, engines, { read: readSystemDateTimeFormat }, { list: listAvailableModels }, randomUUID, factChecks, new SqliteBackupManager(database));
        const editorial = new EditorialService(articles, editorialSessions, styleCorpus, editorialArtifacts, engines, config.aiSessionContinuationEnabled, factChecks);
        const service = createLocalService(config, editorial, services, diagnostics);
        let shuttingDown = false;


        async function shutdown(exitCode: number): Promise<void> {
            if (shuttingDown)
                return;

            shuttingDown = true;
            try {
                await closeLocalService(service);
            } catch (error) {
                if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ERR_SERVER_NOT_RUNNING"))
                    diagnostics.write("service.shutdown_failed", {}, error);
            } finally {
                database.close();
                process.exit(exitCode);
            }
        }


        process.once("SIGINT", () => {
            void shutdown(0);
        });
        process.once("SIGTERM", () => {
            void shutdown(0);
        });

        try {
            await listenForLocalService(service, config.port, config.host);
            diagnostics.write("service.started", { host: config.host, port: config.port });
        } catch (error) {
            diagnostics.write("service.start_failed", {}, error);
            await shutdown(1);
        }
    } catch (error) {
        diagnostics.write("service.start_failed", {}, error);
        process.exitCode = 1;
    }
}


void start();
