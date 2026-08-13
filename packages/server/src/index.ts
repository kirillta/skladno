import { randomUUID } from "node:crypto";
import { loadServerConfig, loadServerEnvironment } from "./infrastructure/configuration/config.js";
import { createLocalService } from "./presentation/server.js";
import { createApplicationServices } from "./application/create-application-services.js";
import { EditorialService } from "./application/editorial/editorial-service.js";
import { openDatabase } from "./infrastructure/persistence/database.js";
import { ConfiguredEditorialEngineResolver } from "./infrastructure/editorial/configured-editorial-engine-resolver.js";
import { listAvailableModels } from "./infrastructure/editorial/available-models.js";
import { readSystemDateTimeFormat } from "./infrastructure/configuration/system-date-time-format.js";
import { ArticlesRepository, AssistantRepository, EditorialArtifactsRepository, EditorialSessionsRepository, FactChecksRepository, SettingsRepository, StyleCorpusRepository } from "./infrastructure/persistence/index.js";
import { closeLocalService, listenForLocalService } from "./infrastructure/lifecycle/service-lifecycle.js";

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
const services = createApplicationServices(articles, settings, styleCorpus, assistant, editorialArtifacts, engines, { read: readSystemDateTimeFormat }, { list: listAvailableModels }, randomUUID, factChecks);
const editorial = new EditorialService(articles, editorialSessions, styleCorpus, editorialArtifacts, engines, config.aiSessionContinuationEnabled, factChecks);
const service = createLocalService(config, editorial, services);
let shuttingDown = false;


function describeStartupError(error: unknown): string {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EADDRINUSE")
        return `Skladno local service could not start because http://${config.host}:${config.port} is already in use. Stop the existing Skladno development server, then try again.`;

    return "Skladno local service could not start.";
}


async function shutdown(exitCode: number): Promise<void> {
    if (shuttingDown)
        return;

    shuttingDown = true;

    try {
        await closeLocalService(service);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING")
            console.error("Skladno local service did not shut down cleanly.", error);
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


void listenForLocalService(service, config.port, config.host)
    .then(() => {
        console.info(`Skladno local service listening at http://${config.host}:${config.port}`);
    })
    .catch((error: unknown) => {
        console.error(describeStartupError(error));
        void shutdown(1);
    });
