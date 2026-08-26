export { createLocalApplication, type LocalApplication } from "./local-application.js";
export type { ApplicationServices } from "./application/application-services.js";
export { loadServerConfig, loadServerEnvironment } from "./infrastructure/configuration/config.js";
export { registerElectronIpcApplicationAdapter } from "./infrastructure/electron/electron-ipc-application-adapter.js";
