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
} as const;


export type ElectronMessages = Record<keyof typeof englishElectronMessages, string>;


const electronCatalogs = {
    [INTERFACE_LOCALE.EN]: englishElectronMessages,
} satisfies Record<InterfaceLocale, ElectronMessages>;


export function electronMessagesFor(locale: InterfaceLocale = defaultInterfaceLocale): ElectronMessages {
    return electronCatalogs[locale];
}
