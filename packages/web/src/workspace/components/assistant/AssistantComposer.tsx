import { useRef, type KeyboardEventHandler } from "react";
import { useIntl } from "react-intl";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { BuiltInSkillId, KeyBindingOverrides } from "@skladno/shared";
import { KEY_BINDING_COMMAND } from "@skladno/shared";
import { Button } from "../../../ui/primitives.js";
import { SendIcon, StopIcon } from "../../../ui/icons.js";
import { shortcutHint } from "../../../key-bindings/shortcut-hint.js";
import type { AssistantSelectionScope } from "../../state/assistant-messages-state.js";
import { AssistantQuickActions, SelectionChip } from "./AssistantComposerActions.js";
import { AssistantSkillTagNode } from "./AssistantSkillTagNode.js";
import { ComposerBridge, PickerKeyboard, PlainTextPaste, type AssistantComposerValue, type AssistantSkillPickerControls } from "./assistant-composer-plugins.js";

export type { AssistantComposerValue } from "./assistant-composer-plugins.js";


type AssistantComposerProps = AssistantSkillPickerControls & {
    state: "idle" | "streaming" | "error";
    canSend: boolean;
    guidance: string;
    selectedSkill?: BuiltInSkillId;
    skillOffset: number;
    caretOffset: number;
    selection?: AssistantSelectionScope;
    clearSelection?: () => void;
    incompatibleSelectionSkill: boolean;
    setActiveSkillIndex: (value: number) => void;
    send: () => void;
    onCancel: () => void;
    onChange: (value: AssistantComposerValue) => void;
    onKeyDown: KeyboardEventHandler<HTMLDivElement>;
    shortcutOverrides?: KeyBindingOverrides;
};


export function AssistantComposer({ state, canSend, guidance, selectedSkill, skillOffset, caretOffset, selection, clearSelection, quickActionsOpen, availableSkills, activeSkillIndex, incompatibleSelectionSkill, setQuickActionsOpen, setActiveSkillIndex, selectSkill, focusQuickAction, send, onCancel, onChange, onKeyDown, shortcutOverrides }: AssistantComposerProps) {
    const intl = useIntl();
    const composer = useRef<HTMLDivElement>(null);
    const value: AssistantComposerValue = { guidance, selectedSkill, skillOffset, caretOffset };
    const activeSkill = availableSkills[activeSkillIndex];

    return <footer className="shrink-0 border-t border-border px-5 py-4">
        {incompatibleSelectionSkill && <p className="mb-2 text-xs text-muted" role="status">{intl.formatMessage({ id: "assistant.selectionSkillUnavailable" })}</p>}
        <div className="flex min-h-25 flex-col rounded-control border border-border bg-surface-raised px-3 py-2">
            <div className="min-h-11 flex-1">
                <SelectionChip selection={selection} clearSelection={clearSelection} />
                <LexicalComposer initialConfig={{ namespace: "skladno-assistant-composer", nodes: [AssistantSkillTagNode], onError: () => undefined }}>
                    <RichTextPlugin contentEditable={<ContentEditable ref={composer} data-assistant-composer role="combobox" aria-autocomplete="list" aria-expanded={quickActionsOpen} aria-activedescendant={quickActionsOpen && activeSkill ? `assistant-skill-option-${activeSkill}` : undefined} aria-multiline="true" aria-label={intl.formatMessage({ id: "assistant.guidance" })} aria-controls={quickActionsOpen ? "assistant-skill-picker" : undefined} className="min-h-11 whitespace-pre-wrap text-sm leading-5 text-ink outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-ink/45" data-placeholder={!guidance && !selectedSkill ? intl.formatMessage({ id: "assistant.guidancePlaceholder" }) : undefined} onKeyDown={onKeyDown} />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
                    <HistoryPlugin />
                    <ComposerBridge value={value} onChange={onChange} />
                    <PlainTextPaste />
                    <PickerKeyboard quickActionsOpen={quickActionsOpen} availableSkills={availableSkills} activeSkillIndex={activeSkillIndex} setQuickActionsOpen={setQuickActionsOpen} selectSkill={selectSkill} focusQuickAction={focusQuickAction} />
                </LexicalComposer>
            </div>
            <div className="flex shrink-0 justify-end">
                {state === "streaming"
                    ? <Button className="inline-grid size-9 place-items-center !p-0" variant="danger" title={shortcutHint(intl.formatMessage({ id: "assistant.stop" }), KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.stop" })} onClick={onCancel}><StopIcon className="size-4" /></Button>
                    : <div className="flex">
                        <Button className="inline-grid size-8 place-items-center rounded-r-none !p-0" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.send" }), KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={!canSend} onClick={send}><SendIcon className="size-4" /></Button>
                        <AssistantQuickActions state={state} composer={composer} quickActionsOpen={quickActionsOpen} availableSkills={availableSkills} activeSkillIndex={activeSkillIndex} setQuickActionsOpen={setQuickActionsOpen} setActiveSkillIndex={setActiveSkillIndex} selectSkill={selectSkill} focusQuickAction={focusQuickAction} />
                    </div>}
            </div>
        </div>
    </footer>;
}
