import { loadServerConfig, loadServerEnvironment } from "./infrastructure/configuration/config.js";
import { randomUUID } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createLocalDiagnostics } from "./infrastructure/diagnostics/local-diagnostics.js";
import { closeLocalService, listenForLocalService } from "./infrastructure/lifecycle/service-lifecycle.js";
import { createLocalApplication } from "./local-application.js";
import { createLocalService } from "./presentation/server.js";
import { validateDatabaseSnapshot } from "./infrastructure/persistence/database.js";
import { BackupBundleTransfers } from "./infrastructure/persistence/backup-bundle.js";
import { completeBrowserRestoreRecovery, prepareBrowserRestoreRecovery, recoverPendingBrowserRestore, removeDatabaseFiles } from "./infrastructure/persistence/browser-restore-recovery.js";

const diagnostics = createLocalDiagnostics();


function copySkillDirectories(source: string, destination: string): void {
    for (const name of ["skills", "skill-history"]) {
        const path = join(source, name);
        if (existsSync(path))
            cpSync(path, join(destination, name), { recursive: true });
    }
}


function replaceSkillDirectories(source: string, destination: string): void {
    for (const name of ["skills", "skill-history"])
        rmSync(join(destination, name), { recursive: true, force: true });

    copySkillDirectories(source, destination);
}


async function start(): Promise<void> {
    try {
        loadServerEnvironment();

        const config = loadServerConfig();
        recoverPendingBrowserRestore(config.databasePath);
        let application = createLocalApplication(config);


        async function restoreBackup(snapshot: Uint8Array, bundleDirectory?: string): Promise<void> {
            const staged = join(dirname(config.databasePath), `skladno.restore-${randomUUID()}.sqlite`);
            try {
                writeFileSync(staged, snapshot, { mode: 0o600 });
                validateDatabaseSnapshot(staged);
                const recovery = application.services.settings.createBackup();
                const recoveryDirectory = mkdtempSync(join(dirname(config.databasePath), "recovery-"));
                try {
                    copyFileSync(recovery.path, join(recoveryDirectory, "database.sqlite"));
                    copySkillDirectories(dirname(config.databasePath), recoveryDirectory);
                } finally {
                    recovery.cleanup();
                }

                prepareBrowserRestoreRecovery(config.databasePath, recoveryDirectory);
                let closed = false;
                let replacementOpened = false;
                try {
                    application.database.close();
                    closed = true;
                    removeDatabaseFiles(config.databasePath);
                    copyFileSync(staged, config.databasePath);
                    if (bundleDirectory)
                        replaceSkillDirectories(bundleDirectory, dirname(config.databasePath));

                    application = createLocalApplication(config);
                    replacementOpened = true;
                    validateDatabaseSnapshot(config.databasePath);
                    completeBrowserRestoreRecovery(config.databasePath);
                } catch (error) {
                    if (closed) {
                        if (replacementOpened)
                            application.database.close();

                        recoverPendingBrowserRestore(config.databasePath);
                        application = createLocalApplication(config);
                    }

                    throw error;
                }
            } finally {
                rmSync(staged, { force: true });
            }
        }


        const backupTransfers = new BackupBundleTransfers(dirname(config.databasePath),
            () => application.services.settings.createBackup(),
            async (directory) => restoreBackup(readFileSync(join(directory, "database.sqlite")), directory));
        const service = createLocalService(config, application.editorial, application.services, diagnostics, () => application, restoreBackup, backupTransfers);
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
