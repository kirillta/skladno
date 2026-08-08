import { loadServerConfig, loadServerEnvironment } from "./config.js";
import { createLocalService } from "./http.js";
import { openDatabase, Repositories } from "./persistence/index.js";
import { closeLocalService, listenForLocalService } from "./service-lifecycle.js";

loadServerEnvironment();

const config = loadServerConfig();
const database = openDatabase(config.databasePath);
const service = createLocalService(config, new Repositories(database));
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
