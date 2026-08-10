import type { FormEventHandler, KeyboardEventHandler, RefObject } from "react";
import { useIntl } from "react-intl";
import type { BuiltInSkillId, KeyBindingOverrides } from "@skladno/shared";
import { Button } from "../../../ui/primitives.js";
import { ChevronDownIcon, SendIcon, StopIcon } from "../../../ui/icons.js";
import { KEY_BINDING_COMMAND } from "@skladno/shared";
import { shortcutHint } from "../../../key-bindings/shortcut-hint.js";
import { skillMessages } from "./assistant-messages.js";


export function AssistantComposer({ state, guidance, selectedSkill, selection, composer, quickActionsOpen, availableSkills, setQuickActionsOpen, setActiveSkillIndex, selectSkill, focusQuickAction, send, onCancel, onInput, onKeyDown, shortcutOverrides }: {
    state: "idle" | "streaming" | "error";
    guidance: string;
    selectedSkill?: BuiltInSkillId;
    selection?: string;
    composer: RefObject<HTMLDivElement>;
    quickActionsOpen: boolean;
    availableSkills: readonly BuiltInSkillId[];
    setQuickActionsOpen: (value: boolean | ((current: boolean) => boolean)) => void;
    setActiveSkillIndex: (value: number) => void;
    selectSkill: (skill: BuiltInSkillId) => void;
    focusQuickAction: (index: number) => void;
    send: () => void;
    onCancel: () => void;
    onInput: FormEventHandler<HTMLDivElement>;
    onKeyDown: KeyboardEventHandler<HTMLDivElement>;
    shortcutOverrides?: KeyBindingOverrides;
}) {
    const intl = useIntl();
    const canSend = state !== "streaming" && Boolean(guidance.trim());

    return <footer className="shrink-0 border-t border-border px-5 py-4">
        <div className="relative mb-3">
            {quickActionsOpen && <div className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-panel border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "assistant.quickActions" })}>
                {availableSkills.map((skill, index) => <Button data-assistant-skill className="flex w-full justify-start text-xs" key={skill} disabled={state === "streaming"} variant="quiet" onClick={() => selectSkill(skill)} onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        focusQuickAction(index + 1);
                    }

                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        focusQuickAction(index - 1);
                    }

                    if (event.key === "Escape") {
                        event.preventDefault();
                        setQuickActionsOpen(false);
                        composer.current?.focus();
                    }
                }}>{intl.formatMessage({ id: skillMessages[skill] })}</Button>)}
            </div>}
            <Button className="flex items-center gap-2" variant="secondary" aria-expanded={quickActionsOpen} onClick={() => setQuickActionsOpen((open) => {
                if (!open)
                    setActiveSkillIndex(0);

                return !open;
            })}>{intl.formatMessage({ id: "assistant.quickActions" })}<ChevronDownIcon className={`size-4 ${quickActionsOpen ? "rotate-180" : ""}`} /></Button>
        </div>
        <div className="relative min-h-25 rounded-control border border-border bg-surface-raised px-3 py-2"><div ref={composer} data-assistant-composer data-placeholder={!guidance && !selectedSkill && !selection ? intl.formatMessage({ id: "assistant.guidancePlaceholder" }) : undefined} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={intl.formatMessage({ id: "assistant.guidance" })} className="min-h-20 whitespace-pre-wrap pr-10 text-sm leading-5 text-ink outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-ink/45" onInput={onInput} onKeyDown={onKeyDown} />
            {state === "streaming"
                ? <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center !p-0" variant="danger" title={shortcutHint(intl.formatMessage({ id: "assistant.stop" }), KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.stop" })} onClick={onCancel}><StopIcon className="size-4" /></Button>
                : <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center !p-0" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.send" }), KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={!canSend} onClick={send}><SendIcon className="size-4" /></Button>}
        </div>
    </footer>;
}
