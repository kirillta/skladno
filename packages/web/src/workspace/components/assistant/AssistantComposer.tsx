import { useEffect, useRef, type KeyboardEventHandler } from "react";
import { useIntl } from "react-intl";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isElementNode, $isRangeSelection, COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from "lexical";
import type { BuiltInSkillId, KeyBindingOverrides } from "@skladno/shared";
import { Button } from "../../../ui/primitives.js";
import { ChevronDownIcon, SendIcon, StopIcon } from "../../../ui/icons.js";
import { KEY_BINDING_COMMAND } from "@skladno/shared";
import { shortcutHint } from "../../../key-bindings/shortcut-hint.js";
import { selectionPreview, skillMessages } from "./assistant-messages.js";
import { $createAssistantSkillTagNode, $isAssistantSkillTagNode, AssistantSkillTagNode } from "./AssistantSkillTagNode.js";
import type { AssistantSelectionScope } from "../../state/assistant-messages-state.js";


export interface AssistantComposerValue {
    guidance: string;
    selectedSkill?: BuiltInSkillId;
    skillOffset: number;
    caretOffset: number;
}


function composerValue(): AssistantComposerValue {
    const blocks = $getRoot().getChildren();
    let guidance = "";
    let selectedSkill: BuiltInSkillId | undefined;
    let skillOffset = 0;

    blocks.forEach((block, index) => {
        const children = $isElementNode(block) ? block.getChildren() : [block];
        for (const child of children) {
            if ($isAssistantSkillTagNode(child)) {
                selectedSkill = child.getSkill();
                skillOffset = guidance.length;
            } else {
                guidance += child.getTextContent();
            }
        }

        if (index < blocks.length - 1)
            guidance += "\n";
    });

    return { guidance, selectedSkill, skillOffset, caretOffset: composerCaretOffset(guidance.length) };
}


function composerCaretOffset(fallback: number): number {
    const selection = $getSelection();
    if (!$isRangeSelection(selection))
        return fallback;

    const anchor = selection.anchor;
    const blocks = $getRoot().getChildren();
    let offset = 0;
    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const children = $isElementNode(block) ? block.getChildren() : [block];
        if (anchor.key === block.getKey() && anchor.type === "element")
            return offset + children.slice(0, anchor.offset).reduce((length, child) => length + child.getTextContent().length, 0);

        for (const child of children) {
            if (child.getKey() === anchor.key)
                return offset + (anchor.type === "text" ? anchor.offset : 0);

            offset += child.getTextContent().length;
        }

        if (index < blocks.length - 1)
            offset += 1;
    }

    return fallback;
}


function setComposerValue(value: AssistantComposerValue): AssistantSkillTagNode | undefined {
    const root = $getRoot();
    root.clear();
    let offset = 0;
    let tag: AssistantSkillTagNode | undefined;
    const lines = value.guidance.split("\n");
    for (const [index, line] of lines.entries()) {
        const paragraph = $createParagraphNode();
        const lineEnd = offset + line.length;
        const skill = value.selectedSkill;
        if (skill !== undefined && value.skillOffset >= offset && value.skillOffset <= lineEnd) {
            const localOffset = value.skillOffset - offset;
            if (localOffset)
                paragraph.append($createTextNode(line.slice(0, localOffset)));

            tag = $createAssistantSkillTagNode(skill);
            paragraph.append(tag);
            if (localOffset < line.length)
                paragraph.append($createTextNode(line.slice(localOffset)));
        } else if (line) {
            paragraph.append($createTextNode(line));
        }

        root.append(paragraph);
        offset = lineEnd + (index < lines.length - 1 ? 1 : 0);
    }

    return tag;
}


function ComposerBridge({ value, onChange }: { value: AssistantComposerValue; onChange: (value: AssistantComposerValue) => void }) {
    const [editor] = useLexicalComposerContext();
    const { guidance, selectedSkill, skillOffset, caretOffset } = value;
    const latestValue = useRef(value);
    latestValue.current = value;

    useEffect(() => {
        let insertedTag = false;
        editor.update(() => {
            const current = composerValue();
            if (current.guidance === guidance && current.selectedSkill === selectedSkill && current.skillOffset === skillOffset) {
                if (!$getSelection())
                    $getRoot().selectEnd();

                return;
            }

            const tag = setComposerValue({ guidance, selectedSkill, skillOffset, caretOffset });
            tag?.selectNext();
            insertedTag = tag !== undefined;
        }, { tag: "assistant-composer-external" });

        if (insertedTag)
            editor.focus();
    }, [caretOffset, editor, guidance, selectedSkill, skillOffset]);

    useEffect(() => editor.registerUpdateListener(({ editorState, tags }) => {
        if (tags.has("assistant-composer-external"))
            return;

        editorState.read(() => {
            const next = composerValue();
            const current = latestValue.current;
            if (next.guidance !== current.guidance || next.selectedSkill !== current.selectedSkill || next.skillOffset !== current.skillOffset || next.caretOffset !== current.caretOffset)
                onChange(next);
        });
    }), [editor, onChange]);

    return null;
}


function PlainTextPaste() {
    const [editor] = useLexicalComposerContext();
    useEffect(() => editor.registerCommand(PASTE_COMMAND, (event: ClipboardEvent) => {
        const text = event.clipboardData?.getData("text/plain");
        const selection = $getSelection();
        if (text === undefined || !$isRangeSelection(selection))
            return false;

        event.preventDefault();
        selection.insertText(text);

        return true;
    }, COMMAND_PRIORITY_HIGH), [editor]);

    return null;
}


function SelectionChip({ selection, clearSelection }: { selection?: AssistantSelectionScope; clearSelection?: () => void }) {
    const intl = useIntl();
    if (!selection)
        return null;

    return <span data-assistant-composer-decoration className="mx-1 inline-flex h-5 min-h-0 max-w-[calc(100%-0.5rem)] items-center gap-1 align-middle rounded-full border border-border bg-surface px-1.5 text-xs font-semibold text-muted" aria-label={intl.formatMessage({ id: "assistant.articleSelection" })} title={selection.preview}>
        <span className="relative -top-px max-w-48 truncate">{selectionPreview(selection.preview)}</span>
        <button type="button" className="inline-grid size-3 min-h-0 place-items-center rounded-full p-0 text-muted hover:bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.clearArticleSelection" })} onClick={clearSelection}>×</button>
    </span>;
}


export function AssistantComposer({ state, canSend, guidance, selectedSkill, skillOffset, caretOffset, selection, clearSelection, quickActionsOpen, availableSkills, activeSkillIndex, incompatibleSelectionSkill, setQuickActionsOpen, setActiveSkillIndex, selectSkill, focusQuickAction, send, onCancel, onChange, onKeyDown, shortcutOverrides }: {
    state: "idle" | "streaming" | "error";
    canSend: boolean;
    guidance: string;
    selectedSkill?: BuiltInSkillId;
    skillOffset: number;
    caretOffset: number;
    selection?: AssistantSelectionScope;
    clearSelection?: () => void;
    quickActionsOpen: boolean;
    availableSkills: readonly BuiltInSkillId[];
    activeSkillIndex: number;
    incompatibleSelectionSkill: boolean;
    setQuickActionsOpen: (value: boolean | ((current: boolean) => boolean)) => void;
    setActiveSkillIndex: (value: number) => void;
    selectSkill: (skill: BuiltInSkillId) => void;
    focusQuickAction: (index: number) => void;
    send: () => void;
    onCancel: () => void;
    onChange: (value: AssistantComposerValue) => void;
    onKeyDown: KeyboardEventHandler<HTMLDivElement>;
    shortcutOverrides?: KeyBindingOverrides;
}) {
    const intl = useIntl();
    const composer = useRef<HTMLDivElement>(null);
    const value = { guidance, selectedSkill, skillOffset, caretOffset };
    return <footer className="shrink-0 border-t border-border px-5 py-4">
        <div className="relative mb-3">
            {quickActionsOpen && <div id="assistant-skill-picker" className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-panel border border-border bg-surface-raised p-1 shadow-raised" role="listbox" aria-label={intl.formatMessage({ id: "assistant.quickActions" })}>
                {availableSkills.map((skill, index) => <Button data-assistant-skill className="flex w-full justify-start text-xs" key={skill} role="option" aria-selected={index === activeSkillIndex} disabled={state === "streaming"} variant="quiet" onClick={() => selectSkill(skill)} onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Tab") {
                        event.preventDefault();
                        selectSkill(skill);
                    }

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
            {quickActionsOpen && <span className="sr-only" aria-live="polite">{intl.formatMessage({ id: "assistant.skillResultCount" }, { count: availableSkills.length })}</span>}
            <Button className="flex items-center gap-2" variant="secondary" aria-expanded={quickActionsOpen} aria-controls="assistant-skill-picker" onClick={() => setQuickActionsOpen((open) => {
                if (!open)
                    setActiveSkillIndex(0);

                return !open;
            })}>{intl.formatMessage({ id: "assistant.quickActions" })}<ChevronDownIcon className={`size-4 ${quickActionsOpen ? "rotate-180" : ""}`} /></Button>
        </div>
        {incompatibleSelectionSkill && <p className="mb-2 text-xs text-muted" role="status">{intl.formatMessage({ id: "assistant.selectionSkillUnavailable" })}</p>}
        <div className="relative min-h-25 rounded-control border border-border bg-surface-raised px-3 py-2">
            <SelectionChip selection={selection} clearSelection={clearSelection} />
            <LexicalComposer initialConfig={{ namespace: "skladno-assistant-composer", nodes: [AssistantSkillTagNode], onError: () => undefined }}>
                <RichTextPlugin contentEditable={<ContentEditable ref={composer} data-assistant-composer role="textbox" aria-multiline="true" aria-label={intl.formatMessage({ id: "assistant.guidance" })} aria-controls={quickActionsOpen ? "assistant-skill-picker" : undefined} className="min-h-20 whitespace-pre-wrap pr-10 text-sm leading-5 text-ink outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-ink/45" data-placeholder={!guidance && !selectedSkill ? intl.formatMessage({ id: "assistant.guidancePlaceholder" }) : undefined} onKeyDown={onKeyDown} />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
                <ComposerBridge value={value} onChange={onChange} />
                <PlainTextPaste />
            </LexicalComposer>
            {state === "streaming"
                ? <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center !p-0" variant="danger" title={shortcutHint(intl.formatMessage({ id: "assistant.stop" }), KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.stop" })} onClick={onCancel}><StopIcon className="size-4" /></Button>
                : <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center !p-0" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.send" }), KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={!canSend} onClick={send}><SendIcon className="size-4" /></Button>}
        </div>
    </footer>;
}
