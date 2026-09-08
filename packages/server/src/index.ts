import { loadServerConfig, loadServerEnvironment } from "./infrastructure/configuration/config.js";
import { copyFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createLocalDiagnostics } from "./infrastructure/diagnostics/local-diagnostics.js";
import { closeLocalService, listenForLocalService } from "./infrastructure/lifecycle/service-lifecycle.js";
import { createLocalApplication } from "./local-application.js";
import { createLocalService } from "./presentation/server.js";
import { validateDatabaseSnapshot } from "./infrastructure/persistence/database.js";

const diagnostics = createLocalDiagnostics();


async function start(): Promise<void> {
    try {
        loadServerEnvironment();

        const config = loadServerConfig();
        let application = createLocalApplication(config);


        async function restoreBackup(snapshot: Uint8Array): Promise<void> {
            const staged = join(dirname(config.databasePath), "skladno.restore.sqlite");
            const recovery = application.services.settings.createBackup();
            try {
                writeFileSync(staged, snapshot, { mode: 0o600 });
                validateDatabaseSnapshot(staged);
                application.database.close();

                rmSync(config.databasePath, { force: true });
                rmSync(`${config.databasePath}-wal`, { force: true });
                rmSync(`${config.databasePath}-shm`, { force: true });

                copyFileSync(staged, config.databasePath);
                application = createLocalApplication(config);
                validateDatabaseSnapshot(config.databasePath);
            } catch (error) {
                rmSync(config.databasePath, { force: true });
                rmSync(`${config.databasePath}-wal`, { force: true });
                rmSync(`${config.databasePath}-shm`, { force: true });

                copyFileSync(recovery.path, config.databasePath);
                application = createLocalApplication(config);

                throw error;
            } finally {
                rmSync(staged, { force: true });
                recovery.cleanup();
            }
        }


        const service = createLocalService(config, application.editorial, application.services, diagnostics, () => application, restoreBackup);
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
                application.database.close();
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
