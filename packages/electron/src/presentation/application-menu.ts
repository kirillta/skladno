import type { MenuItemConstructorOptions } from "electron";
import { KEY_BINDING_COMMAND, type ElectronMessages, type KeyBindingCommandId } from "@skladno/shared";


export function createApplicationMenu(messages: ElectronMessages, actions: { triggerCommand(command: KeyBindingCommandId): void; checkForUpdates(): void }): MenuItemConstructorOptions[] {
    const command = (label: string, commandId: KeyBindingCommandId): MenuItemConstructorOptions => ({ label, click: () => actions.triggerCommand(commandId) });

    return [
        {
            label: messages["electron.menu.file"],
            submenu: [
                command(messages["electron.menu.newArticle"], KEY_BINDING_COMMAND.NEW_ARTICLE),
                command(messages["electron.menu.saveRevision"], KEY_BINDING_COMMAND.SAVE_REVISION),
                { type: "separator" },
                command(messages["electron.menu.settings"], KEY_BINDING_COMMAND.OPEN_SETTINGS),
                { type: "separator" },
                { role: "close" },
                { role: "quit" },
            ],
        },
        {
            label: messages["electron.menu.edit"],
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "selectAll" },
                { type: "separator" },
                command(messages["electron.menu.searchArticles"], KEY_BINDING_COMMAND.SEARCH_ARTICLES),
            ],
        },
        {
            label: messages["electron.menu.view"],
            submenu: [
                command(messages["electron.menu.write"], KEY_BINDING_COMMAND.VIEW_WRITE),
                command(messages["electron.menu.proposals"], KEY_BINDING_COMMAND.VIEW_PROPOSAL),
                command(messages["electron.menu.revisions"], KEY_BINDING_COMMAND.VIEW_REVISIONS),
                command(messages["electron.menu.factCheck"], KEY_BINDING_COMMAND.VIEW_FACT_CHECK),
                command(messages["electron.menu.styleProfile"], KEY_BINDING_COMMAND.VIEW_STYLE_PROFILE),
                command(messages["electron.menu.translations"], KEY_BINDING_COMMAND.VIEW_TRANSLATIONS),
                { type: "separator" },
                command(messages["electron.menu.focusMode"], KEY_BINDING_COMMAND.TOGGLE_FOCUS_MODE),
                command(messages["electron.menu.articleLibrary"], KEY_BINDING_COMMAND.TOGGLE_ARTICLE_LIBRARY),
                command(messages["electron.menu.editorialAssistant"], KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT),
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { role: "togglefullscreen" },
            ],
        },
        {
            label: messages["electron.menu.window"],
            submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
        },
        {
            label: messages["electron.menu.help"],
            submenu: [{ label: messages["electron.menu.checkUpdates"], click: actions.checkForUpdates }],
        },
    ];
}
