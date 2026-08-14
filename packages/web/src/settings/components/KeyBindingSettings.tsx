import { useState, type KeyboardEvent } from "react";
import { findKeyBindingConflict, formatKeyBinding, keyBindingCommands, keyBindingsEqual, normalizeKeyBinding, resolveKeyBindings, type KeyBindingCommandId, type KeyBindingOverrides } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Banner, Button } from "../../ui/primitives.js";


export function KeyBindingSettings({ overrides, save }: { overrides: KeyBindingOverrides; save: (next: KeyBindingOverrides) => Promise<void> }) {
    const intl = useIntl();
    const [recording, setRecording] = useState<KeyBindingCommandId>();
    const [error, setError] = useState<{ commandId: KeyBindingCommandId; assignedCommand: string }>();
    const platform = typeof navigator === "undefined" ? "" : navigator.platform;
    const effective = resolveKeyBindings(overrides);


    async function record(commandId: KeyBindingCommandId, event: KeyboardEvent<HTMLButtonElement>) {
        if (recording !== commandId)
            return;

        event.preventDefault();
        if (event.key === "Escape" && commandId !== "stop_editorial_request") {
            setRecording(undefined);
            return;
        }

        const binding = normalizeKeyBinding({ primary: event.ctrlKey || event.metaKey, shift: event.shiftKey, alt: event.altKey, key: event.key });
        if (!binding)
            return;

        const next = { ...overrides, [commandId]: binding };
        const conflict = findKeyBindingConflict(resolveKeyBindings(next));
        if (conflict) {
            const other = conflict.find((id) => id !== commandId) ?? commandId;
            const command = keyBindingCommands.find((item) => item.id === other)!;
            setError({
                commandId,
                assignedCommand: intl.formatMessage({ id: command.labelMessageId }),
            });

            return;
        }

        setError(undefined);
        setRecording(undefined);
        await save(next);
    }


    return <>
        <p className="mt-3 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.keyBindingsIntro" })}</p>
        {(["general", "workspace", "assistant"] as const).map((category) => <section key={category} className="border-b border-border py-5 last:border-b-0">
            <h2 className="text-sm font-semibold">{intl.formatMessage({ id: `settings.keyBindingCategory.${category}` })}</h2>
            <div className="mt-3 grid gap-3">{keyBindingCommands.filter((command) => command.category === category).map((command) => {
                const override = overrides[command.id];
                const isOverridden = Object.prototype.hasOwnProperty.call(overrides, command.id)
                    && (override === null || (override !== undefined && !keyBindingsEqual(override, command.defaultBinding)));
                const listening = recording === command.id;
                return <div key={command.id} className="rounded-control border border-border p-3">
                    <p className="text-sm font-medium">{intl.formatMessage({ id: command.labelMessageId })}</p>
                    <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: command.hintMessageId })}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button variant={listening ? "secondary" : "quiet"} aria-label={intl.formatMessage({ id: "settings.recordKeyBinding" }, { command: intl.formatMessage({ id: command.labelMessageId }) })} aria-describedby={error?.commandId === command.id ? `key-binding-error-${command.id}` : undefined} onBlur={() => {
                            if (recording === command.id) {
                                setRecording(undefined);
                                setError((current) => current?.commandId === command.id ? undefined : current);
                            }
                        }} onClick={() => {
                            setError(undefined);
                            setRecording(command.id);
                        }} onKeyDown={(event) => void record(command.id, event)}>{listening ? intl.formatMessage({ id: "settings.recordingKeyBinding" }) : formatKeyBinding(effective[command.id], platform)}</Button>
                        <Button variant="quiet" onClick={() => {
                            setError(undefined);
                            void save({ ...overrides, [command.id]: null });
                        }}>{intl.formatMessage({ id: "settings.clearKeyBinding" })}</Button>
                        {isOverridden && <Button variant="quiet" onClick={() => {
                            const next = { ...overrides };
                            delete next[command.id];
                            setError(undefined);
                            void save(next);
                        }}>{intl.formatMessage({ id: "settings.resetKeyBinding" })}</Button>}
                    </div>
                    {error?.commandId === command.id && <div id={`key-binding-error-${command.id}`} className="mt-3" role="alert">
                        <Banner tone="warning" role="alert"><span>{intl.formatMessage({ id: "settings.keyBindingConflictTitle" })} <strong>{error.assignedCommand}</strong>. {intl.formatMessage({ id: "settings.keyBindingConflict" })}</span></Banner>
                    </div>}
                </div>;
            })}</div>
        </section>)}
    </>;
}
