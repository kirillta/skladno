import { KEY_BINDING_COMMAND } from "../cross-cutting/key-bindings.js";


export const desktopShellCommands = [
    KEY_BINDING_COMMAND.CLOSE_WINDOW,
    KEY_BINDING_COMMAND.QUIT,
    KEY_BINDING_COMMAND.CHECK_FOR_UPDATES,
    KEY_BINDING_COMMAND.UNDO,
    KEY_BINDING_COMMAND.REDO,
    KEY_BINDING_COMMAND.CUT,
    KEY_BINDING_COMMAND.COPY,
    KEY_BINDING_COMMAND.PASTE,
    KEY_BINDING_COMMAND.SELECT_ALL,
    KEY_BINDING_COMMAND.ZOOM_IN,
    KEY_BINDING_COMMAND.ZOOM_OUT,
    KEY_BINDING_COMMAND.RESET_ZOOM,
    KEY_BINDING_COMMAND.TOGGLE_FULLSCREEN,
    KEY_BINDING_COMMAND.MINIMIZE_WINDOW,
    KEY_BINDING_COMMAND.TOGGLE_MAXIMIZE,
] as const;


export type DesktopShellCommand = typeof desktopShellCommands[number];


export interface DesktopShellClient {
    execute(command: DesktopShellCommand): void;
}


const desktopShellCommandIds = new Set<string>(desktopShellCommands);


export function isDesktopShellCommand(value: unknown): value is DesktopShellCommand {
    return typeof value === "string" && desktopShellCommandIds.has(value);
}
