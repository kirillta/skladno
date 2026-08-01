import { formatKeyBinding, resolveKeyBindings, type KeyBindingCommandId, type KeyBindingOverrides } from "@skladno/shared";

export function shortcutHint(label: string, commandId: KeyBindingCommandId, overrides: KeyBindingOverrides = {}): string {
    const platform = typeof navigator === "undefined" ? "" : navigator.platform;
    return `${label} (${formatKeyBinding(resolveKeyBindings(overrides)[commandId], platform).replaceAll("+", " + ")})`;
}
