import { keyBindingCommands, keyBindingsEqual, normalizeKeyBinding, resolveKeyBindings, type KeyBindingCommandId, type KeyBindingOverrides, type KeyBindingScope } from "@skladno/shared";


export interface KeyBindingEvent {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    repeat: boolean;
    isComposing: boolean;
    target: EventTarget | null;
    preventDefault(): void;
}


export type KeyBindingHandler = () => void;


function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;

    return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}


export function eventKeyBinding(event: Pick<KeyBindingEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">) {
    return normalizeKeyBinding({ primary: event.ctrlKey || event.metaKey, shift: event.shiftKey, alt: event.altKey, key: event.key });
}


export class KeyBindingDispatcher {
    private overrides: KeyBindingOverrides = {};


    private readonly handlers = new Map<KeyBindingCommandId, KeyBindingHandler>();


    setOverrides(overrides: KeyBindingOverrides): void {
        this.overrides = overrides;
    }


    register(commandId: KeyBindingCommandId, handler: KeyBindingHandler): () => void {
        this.handlers.set(commandId, handler);
        return () => {
            if (this.handlers.get(commandId) === handler)
                this.handlers.delete(commandId);
        };
    }


    dispatch(event: KeyBindingEvent, scope: KeyBindingScope = "application"): boolean {
        if (event.repeat || event.isComposing)
            return false;

        const binding = eventKeyBinding(event);
        if (!binding)
            return false;

        const resolved = resolveKeyBindings(this.overrides);
        const matches = (candidate: typeof keyBindingCommands[number]) => {
            const candidateBinding = resolved[candidate.id];
            return candidateBinding != null && keyBindingsEqual(candidateBinding, binding);
        };
        let command = keyBindingCommands.find((candidate) => candidate.scope === scope && matches(candidate));

        if (!command && scope !== "application")
            command = keyBindingCommands.find((candidate) => candidate.scope === "application" && matches(candidate));

        if (!command || (isEditableTarget(event.target) && !command.allowInEditable))
            return false;

        const handler = this.handlers.get(command.id);
        if (!handler)
            return false;

        event.preventDefault();
        handler();

        return true;
    }
}
