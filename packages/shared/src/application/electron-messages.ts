import { defaultInterfaceLocale, INTERFACE_LOCALE, type InterfaceLocale } from "../settings/settings.js";


const englishElectronMessages = {
    "electron.draftCheckpointFailed.title": "Draft checkpoint failed",
    "electron.draftCheckpointFailed.message": "Skladno could not save the latest Draft checkpoint.",
    "electron.draftCheckpointFailed.detail": "Return to the Article and try again, or quit without the latest unsaved changes.",
    "electron.draftCheckpointFailed.return": "Return to Article",
    "electron.draftCheckpointFailed.quit": "Quit without latest checkpoint",
    "electron.closeFailed.title": "Skladno could not close cleanly",
    "electron.closeFailed.message": "The Draft checkpoint completed, but the local database did not close cleanly.",
    "electron.startFailed.title": "Skladno could not start",
    "electron.startFailed.message": "Check that the local data directory is available, then try again.",
    "electron.deleteData.title": "Delete all local Skladno data?",
    "electron.deleteData.message": "This permanently removes Articles, Draft checkpoints, Revisions, Assistant history, style data, settings, and local backups in Skladno’s data directory.",
    "electron.deleteData.detail": "Skladno will close after deletion. A backup can be created first when a backup folder is configured.",
    "electron.deleteData.backup": "Create a backup before deletion",
    "electron.deleteData.delete": "Delete all local data",
    "electron.deleteData.cancel": "Cancel",
    "electron.restoreBackup.title": "Restore this backup?",
    "electron.restoreBackup.message": "This replaces your active local Skladno data with the selected backup.",
    "electron.restoreBackup.detail": "Skladno will save the latest Draft checkpoints, keep a recovery copy of the active data, then restart. This cannot be undone from Settings.",
    "electron.restoreBackup.restore": "Restore and restart",
    "electron.restoreBackup.cancel": "Cancel",
    "electron.restoreFailed.title": "Couldn’t restore the backup",
    "electron.restoreFailed.message": "Close any other Skladno windows or local development servers using this data, then try again. Your active data is unchanged.",
} as const;


export type ElectronMessages = Record<keyof typeof englishElectronMessages, string>;


const electronCatalogs = {
    [INTERFACE_LOCALE.EN]: englishElectronMessages,
} satisfies Record<InterfaceLocale, ElectronMessages>;


export function electronMessagesFor(locale: InterfaceLocale = defaultInterfaceLocale): ElectronMessages {
    return electronCatalogs[locale];
}
