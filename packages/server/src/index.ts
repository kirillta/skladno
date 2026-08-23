import { loadServerConfig, loadServerEnvironment } from "./infrastructure/configuration/config.js";
import { createLocalDiagnostics } from "./infrastructure/diagnostics/local-diagnostics.js";
import { closeLocalService, listenForLocalService } from "./infrastructure/lifecycle/service-lifecycle.js";
import { createLocalApplication } from "./local-application.js";
import { createLocalService } from "./presentation/server.js";

const diagnostics = createLocalDiagnostics();


async function start(): Promise<void> {
    try {
        loadServerEnvironment();

        const config = loadServerConfig();
        const { database, services, editorial } = createLocalApplication(config);
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
