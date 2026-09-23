export const KEY_BINDING_COMMAND = {
    NEW_ARTICLE: "new_article",
    SAVE_REVISION: "save_revision",
    SEARCH_ARTICLES: "search_articles",
    OPEN_SETTINGS: "open_settings",
    CLOSE_WINDOW: "close_window",
    QUIT: "quit",
    CHECK_FOR_UPDATES: "check_for_updates",
    UNDO: "undo",
    REDO: "redo",
    CUT: "cut",
    COPY: "copy",
    PASTE: "paste",
    SELECT_ALL: "select_all",
    TOGGLE_FOCUS_MODE: "toggle_focus_mode",
    TOGGLE_ARTICLE_LIBRARY: "toggle_article_library",
    TOGGLE_EDITORIAL_ASSISTANT: "toggle_editorial_assistant",
    VIEW_WRITE: "view_write",
    VIEW_PROPOSAL: "view_proposal",
    VIEW_REVISIONS: "view_revisions",
    VIEW_FACT_CHECK: "view_fact_check",
    VIEW_STYLE_PROFILE: "view_style_profile",
    VIEW_TRANSLATIONS: "view_translations",
    ZOOM_IN: "zoom_in",
    ZOOM_OUT: "zoom_out",
    RESET_ZOOM: "reset_zoom",
    TOGGLE_FULLSCREEN: "toggle_fullscreen",
    MINIMIZE_WINDOW: "minimize_window",
    TOGGLE_MAXIMIZE: "toggle_maximize",
    SEND_EDITORIAL_REQUEST: "send_editorial_request",
    STOP_EDITORIAL_REQUEST: "stop_editorial_request",
} as const;

export type KeyBindingCommandId = typeof KEY_BINDING_COMMAND[keyof typeof KEY_BINDING_COMMAND];
export type KeyBindingCategory = "general" | "editing" | "workspace" | "window" | "assistant";
export type KeyBindingScope = "application" | "assistant";


export interface KeyBinding {
    primary: boolean;
    shift: boolean;
    alt: boolean;
    key: string;
}


export type KeyBindingOverrides = Partial<Record<KeyBindingCommandId, KeyBinding | null>>;


export interface KeyBindingCommand {
    id: KeyBindingCommandId;
    category: KeyBindingCategory;
    labelMessageId: string;
    hintMessageId: string;
    defaultBinding: KeyBinding;
    scope: KeyBindingScope;
    allowInEditable: boolean;
}


function createKeyBinding(key: string, options: Partial<Omit<KeyBinding, "key">> = {}): KeyBinding {
    return { primary: true, shift: false, alt: false, ...options, key };
}


export const keyBindingCommands = [
    { id: KEY_BINDING_COMMAND.NEW_ARTICLE, category: "general", labelMessageId: "keyBindings.newArticle", hintMessageId: "keyBindings.generalHint", defaultBinding: createKeyBinding("n"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.SAVE_REVISION, category: "general", labelMessageId: "keyBindings.saveRevision", hintMessageId: "keyBindings.generalHint", defaultBinding: createKeyBinding("s"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.SEARCH_ARTICLES, category: "general", labelMessageId: "keyBindings.searchArticles", hintMessageId: "keyBindings.generalHint", defaultBinding: createKeyBinding("f"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.OPEN_SETTINGS, category: "general", labelMessageId: "keyBindings.openSettings", hintMessageId: "keyBindings.generalHint", defaultBinding: createKeyBinding(","), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.CLOSE_WINDOW, category: "general", labelMessageId: "keyBindings.closeWindow", hintMessageId: "keyBindings.generalHint", defaultBinding: createKeyBinding("w"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.QUIT, category: "general", labelMessageId: "keyBindings.quit", hintMessageId: "keyBindings.generalHint", defaultBinding: createKeyBinding("q"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.CHECK_FOR_UPDATES, category: "general", labelMessageId: "keyBindings.checkForUpdates", hintMessageId: "keyBindings.generalHint", defaultBinding: createKeyBinding("u", { shift: true }), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.UNDO, category: "editing", labelMessageId: "keyBindings.undo", hintMessageId: "keyBindings.editingHint", defaultBinding: createKeyBinding("z"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.REDO, category: "editing", labelMessageId: "keyBindings.redo", hintMessageId: "keyBindings.editingHint", defaultBinding: createKeyBinding("y"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.CUT, category: "editing", labelMessageId: "keyBindings.cut", hintMessageId: "keyBindings.editingHint", defaultBinding: createKeyBinding("x"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.COPY, category: "editing", labelMessageId: "keyBindings.copy", hintMessageId: "keyBindings.editingHint", defaultBinding: createKeyBinding("c"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.PASTE, category: "editing", labelMessageId: "keyBindings.paste", hintMessageId: "keyBindings.editingHint", defaultBinding: createKeyBinding("v"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.SELECT_ALL, category: "editing", labelMessageId: "keyBindings.selectAll", hintMessageId: "keyBindings.editingHint", defaultBinding: createKeyBinding("a"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.TOGGLE_FOCUS_MODE, category: "workspace", labelMessageId: "keyBindings.toggleFocusMode", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("f", { shift: true }), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.TOGGLE_ARTICLE_LIBRARY, category: "workspace", labelMessageId: "keyBindings.toggleArticleLibrary", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("l", { shift: true }), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, category: "workspace", labelMessageId: "keyBindings.toggleEditorialAssistant", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("a", { shift: true }), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.VIEW_WRITE, category: "workspace", labelMessageId: "keyBindings.viewWrite", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("1"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.VIEW_PROPOSAL, category: "workspace", labelMessageId: "keyBindings.viewProposal", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("2"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.VIEW_REVISIONS, category: "workspace", labelMessageId: "keyBindings.viewRevisions", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("3"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.VIEW_FACT_CHECK, category: "workspace", labelMessageId: "keyBindings.viewFactCheck", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("4"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.VIEW_STYLE_PROFILE, category: "workspace", labelMessageId: "keyBindings.viewStyleProfile", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("5"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.VIEW_TRANSLATIONS, category: "workspace", labelMessageId: "keyBindings.viewTranslations", hintMessageId: "keyBindings.workspaceHint", defaultBinding: createKeyBinding("6"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.ZOOM_IN, category: "window", labelMessageId: "keyBindings.zoomIn", hintMessageId: "keyBindings.windowHint", defaultBinding: createKeyBinding("+", { shift: true }), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.ZOOM_OUT, category: "window", labelMessageId: "keyBindings.zoomOut", hintMessageId: "keyBindings.windowHint", defaultBinding: createKeyBinding("-"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.RESET_ZOOM, category: "window", labelMessageId: "keyBindings.resetZoom", hintMessageId: "keyBindings.windowHint", defaultBinding: createKeyBinding("0"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.TOGGLE_FULLSCREEN, category: "window", labelMessageId: "keyBindings.toggleFullscreen", hintMessageId: "keyBindings.windowHint", defaultBinding: { primary: false, shift: false, alt: false, key: "f11" }, scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.MINIMIZE_WINDOW, category: "window", labelMessageId: "keyBindings.minimizeWindow", hintMessageId: "keyBindings.windowHint", defaultBinding: createKeyBinding("m"), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.TOGGLE_MAXIMIZE, category: "window", labelMessageId: "keyBindings.toggleMaximize", hintMessageId: "keyBindings.windowHint", defaultBinding: createKeyBinding("m", { shift: true }), scope: "application", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, category: "assistant", labelMessageId: "keyBindings.sendEditorialRequest", hintMessageId: "keyBindings.assistantHint", defaultBinding: createKeyBinding("enter"), scope: "assistant", allowInEditable: true },
    { id: KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, category: "assistant", labelMessageId: "keyBindings.stopEditorialRequest", hintMessageId: "keyBindings.assistantHint", defaultBinding: { primary: false, shift: false, alt: false, key: "escape" }, scope: "assistant", allowInEditable: false },
] as const satisfies readonly KeyBindingCommand[];

const commandIds = new Set<KeyBindingCommandId>(keyBindingCommands.map((command) => command.id));


export function isKeyBindingCommandId(value: unknown): value is KeyBindingCommandId {
    return typeof value === "string" && commandIds.has(value as KeyBindingCommandId);
}


export function normalizeKeyBinding(value: unknown): KeyBinding | undefined {
    if (!value || typeof value !== "object")
        return undefined;

    const candidate = value as Partial<KeyBinding>;
    if (typeof candidate.key !== "string")
        return undefined;

    const key = candidate.key.trim().toLowerCase();
    if (!key || ["control", "shift", "alt", "meta", "primary"].includes(key))
        return undefined;

    return { primary: candidate.primary === true, shift: candidate.shift === true, alt: candidate.alt === true, key };
}


export function areKeyBindingsEqual(left: KeyBinding, right: KeyBinding): boolean {
    return left.primary === right.primary && left.shift === right.shift && left.alt === right.alt && left.key === right.key;
}


export function resolveKeyBindings(overrides: KeyBindingOverrides = {}): Record<KeyBindingCommandId, KeyBinding | null> {
    return Object.fromEntries(keyBindingCommands.map((command) => [command.id, Object.prototype.hasOwnProperty.call(overrides, command.id) ? overrides[command.id]! : command.defaultBinding])) as Record<KeyBindingCommandId, KeyBinding | null>;
}


export function findKeyBindingConflict(bindings: Record<KeyBindingCommandId, KeyBinding | null>): [KeyBindingCommandId, KeyBindingCommandId] | undefined {
    const entries = Object.entries(bindings) as [KeyBindingCommandId, KeyBinding | null][];
    for (let index = 0; index < entries.length; index += 1) {
        const [firstId, first] = entries[index]!;
        if (!first)
            continue;

        const duplicate = entries.slice(index + 1).find(([, second]) => second && areKeyBindingsEqual(first, second));
        if (duplicate)
            return [firstId, duplicate[0]];
    }
}


export function formatKeyBinding(binding: KeyBinding | null, platform = ""): string {
    if (!binding)
        return "Unassigned";

    return [formatPrimary(binding, platform), formatAlt(binding, platform), formatShift(binding), formatKey(binding.key)].filter(Boolean).join("+");
}


function formatPrimary(binding: KeyBinding, platform: string): string {
    return binding.primary ? (/mac|iphone|ipad/i.test(platform) ? "Command" : "Ctrl") : "";
}


function formatAlt(binding: KeyBinding, platform: string): string {
    return binding.alt ? (/mac|iphone|ipad/i.test(platform) ? "Option" : "Alt") : "";
}


function formatShift(binding: KeyBinding): string {
    return binding.shift && !(binding.primary && binding.key === "+") ? "Shift" : "";
}


function formatKey(key: string): string {
    if (key === "enter")
        return "Enter";

    if (key === "escape")
        return "Esc";

    return key.toUpperCase();
}
