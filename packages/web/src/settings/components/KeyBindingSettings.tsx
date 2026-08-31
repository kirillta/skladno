import { useState, type KeyboardEvent } from "react";
import { findKeyBindingConflict, formatKeyBinding, isAssistantSendMode, KEY_BINDING_COMMAND, keyBindingCommands, keyBindingsEqual, normalizeKeyBinding, resolveKeyBindings, type GeneralSettings, type KeyBindingCommandId, type KeyBindingOverrides } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Banner, Button, Select } from "../../ui/primitives.js";
import { SettingRow, SettingsGroup } from "./SettingRow.js";


export function KeyBindingSettings({ overrides, save, general, saveGeneral }: { overrides: KeyBindingOverrides; save: (next: KeyBindingOverrides) => Promise<void>; general: GeneralSettings; saveGeneral: (next: GeneralSettings) => Promise<void> }) {
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
        {(["general", "editing", "workspace", "window", "assistant"] as const).map((category) => <SettingsGroup key={category} label={intl.formatMessage({ id: `settings.keyBindingCategory.${category}` })}>
            {category === "assistant" && <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.assistantSendMode" })} hint={intl.formatMessage({ id: "settings.assistantSendModeHint" })}>
                <Select aria-label={intl.formatMessage({ id: "settings.assistantSendMode" })} value={general.assistantSendMode} onChange={(event) => {
                    const value = event.target.value;
                    if (isAssistantSendMode(value))
                        void saveGeneral({ ...general, assistantSendMode: value });
                }}>
                    <option value="enter">{intl.formatMessage({ id: "settings.sendWithEnter" })}</option>
                    <option value="ctrl-enter">{intl.formatMessage({ id: "settings.sendWithCtrlEnter" })}</option>
                </Select>
            </SettingRow>}
            {keyBindingCommands.filter((command) => command.category === category && command.id !== KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST).map((command) => {
                const override = overrides[command.id];
                const isOverridden = Object.prototype.hasOwnProperty.call(overrides, command.id)
                    && (override === null || (override !== undefined && !keyBindingsEqual(override, command.defaultBinding)));
                const listening = recording === command.id;
                return <SettingRow key={command.id} headingLevel={3} label={intl.formatMessage({ id: command.labelMessageId })} hint={intl.formatMessage({ id: command.hintMessageId })}>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant={listening ? "secondary" : "quiet"} aria-label={intl.formatMessage({ id: "settings.recordKeyBinding" }, { command: intl.formatMessage({ id: command.labelMessageId }) })} aria-describedby={error?.commandId === command.id ? `key-binding-error-${command.id}` : undefined} onBlur={() => {
                            if (recording === command.id) {
                                setRecording(undefined);
                                setError((current) => current?.commandId === command.id ? undefined : current);
                            }
                        }} onClick={() => {
                            setError(undefined);
                            setRecording(command.id);
                        }} onKeyDown={(event) => void record(command.id, event)}>{listening ? intl.formatMessage({ id: "settings.recordingKeyBinding" }) : formatKeyBinding(effective[command.id], platform)}
                        </Button>
                        <Button variant="quiet" onClick={() => {
                            setError(undefined);
                            void save({ ...overrides, [command.id]: null });
                        }}>{intl.formatMessage({ id: "settings.clearKeyBinding" })}
                        </Button>
                        {isOverridden && <Button variant="quiet" onClick={() => {
                            const next = { ...overrides };
                            delete next[command.id];
                            setError(undefined);
                            void save(next);
                        }}>{intl.formatMessage({ id: "settings.resetKeyBinding" })}
                        </Button>}
                    </div>
                    {error?.commandId === command.id && <div id={`key-binding-error-${command.id}`} className="mt-3" role="alert">
                        <Banner tone="warning" role="alert">
                            <span>
                                {intl.formatMessage({ id: "settings.keyBindingConflictTitle" })} <strong>{error.assignedCommand}</strong>. {intl.formatMessage({ id: "settings.keyBindingConflict" })}
                            </span>
                        </Banner>
                    </div>}
                </SettingRow>;
            })}
        </SettingsGroup>)}
    </>;
}
