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
    "electron.menu.file": "File",
    "electron.menu.newArticle": "New Article",
    "electron.menu.saveRevision": "Save Revision",
    "electron.menu.settings": "Settings",
    "electron.menu.edit": "Edit",
    "electron.menu.searchArticles": "Search Articles",
    "electron.menu.view": "View",
    "electron.menu.write": "Write",
    "electron.menu.proposals": "Proposals",
    "electron.menu.revisions": "Revisions",
    "electron.menu.factCheck": "Fact Check",
    "electron.menu.styleProfile": "Style Profile",
    "electron.menu.translations": "Translations",
    "electron.menu.focusMode": "Focus Mode",
    "electron.menu.articleLibrary": "Article Library",
    "electron.menu.editorialAssistant": "Editorial Assistant",
    "electron.menu.window": "Window",
    "electron.menu.help": "Help",
    "electron.menu.checkUpdates": "Check for Updates",
} as const;


export type ElectronMessages = Record<keyof typeof englishElectronMessages, string>;


const electronCatalogs = {
    [INTERFACE_LOCALE.EN]: englishElectronMessages,
} satisfies Record<InterfaceLocale, ElectronMessages>;


export function electronMessagesFor(locale: InterfaceLocale = defaultInterfaceLocale): ElectronMessages {
    return electronCatalogs[locale];
}
