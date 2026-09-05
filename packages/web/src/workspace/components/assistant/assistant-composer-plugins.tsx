import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isElementNode, $isRangeSelection, COMMAND_PRIORITY_HIGH, KEY_ARROW_DOWN_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, KEY_TAB_COMMAND, PASTE_COMMAND, SKIP_DOM_SELECTION_TAG } from "lexical";
import type { BuiltInSkillId } from "@skladno/shared";
import { $createAssistantSkillTagNode, $isAssistantSkillTagNode, type AssistantSkillTagNode } from "./AssistantSkillTagNode.js";


export interface AssistantComposerValue {
    guidance: string;
    selectedSkill?: BuiltInSkillId;
    skillOffset: number;
    caretOffset: number;
}


export interface AssistantSkillPickerControls {
    quickActionsOpen: boolean;
    availableSkills: readonly BuiltInSkillId[];
    activeSkillIndex: number;
    setQuickActionsOpen: (value: boolean | ((current: boolean) => boolean)) => void;
    selectSkill: (skill: BuiltInSkillId) => void;
    focusQuickAction: (index: number) => void;
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
        if (value.selectedSkill !== undefined && value.skillOffset >= offset && value.skillOffset <= lineEnd) {
            const localOffset = value.skillOffset - offset;
            if (localOffset)
                paragraph.append($createTextNode(line.slice(0, localOffset)));

            tag = $createAssistantSkillTagNode(value.selectedSkill);
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


export function ComposerBridge({ value, onChange }: { value: AssistantComposerValue; onChange: (value: AssistantComposerValue) => void }) {
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
        }, { tag: ["assistant-composer-external", SKIP_DOM_SELECTION_TAG] });

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


export function PlainTextPaste() {
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


export function PickerKeyboard({ quickActionsOpen, availableSkills, activeSkillIndex, setQuickActionsOpen, selectSkill, focusQuickAction }: AssistantSkillPickerControls) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (event) => {
        if (!quickActionsOpen)
            return false;

        event.preventDefault();
        focusQuickAction(activeSkillIndex + 1);
        return true;
    }, COMMAND_PRIORITY_HIGH), [activeSkillIndex, editor, focusQuickAction, quickActionsOpen]);
    useEffect(() => editor.registerCommand(KEY_ARROW_UP_COMMAND, (event) => {
        if (!quickActionsOpen)
            return false;

        event.preventDefault();
        focusQuickAction(activeSkillIndex - 1);
        return true;
    }, COMMAND_PRIORITY_HIGH), [activeSkillIndex, editor, focusQuickAction, quickActionsOpen]);
    useEffect(() => editor.registerCommand(KEY_ENTER_COMMAND, (event) => selectActiveSkill({ event, quickActionsOpen, availableSkills, activeSkillIndex, selectSkill }), COMMAND_PRIORITY_HIGH), [activeSkillIndex, availableSkills, editor, quickActionsOpen, selectSkill]);
    useEffect(() => editor.registerCommand(KEY_TAB_COMMAND, (event) => selectActiveSkill({ event, quickActionsOpen, availableSkills, activeSkillIndex, selectSkill }), COMMAND_PRIORITY_HIGH), [activeSkillIndex, availableSkills, editor, quickActionsOpen, selectSkill]);
    useEffect(() => editor.registerCommand(KEY_ESCAPE_COMMAND, (event) => {
        if (!quickActionsOpen)
            return false;

        event.preventDefault();
        setQuickActionsOpen(false);
        return true;
    }, COMMAND_PRIORITY_HIGH), [editor, quickActionsOpen, setQuickActionsOpen]);

    return null;
}


function selectActiveSkill({ event, quickActionsOpen, availableSkills, activeSkillIndex, selectSkill }: Pick<AssistantSkillPickerControls, "quickActionsOpen" | "availableSkills" | "activeSkillIndex" | "selectSkill"> & { event: KeyboardEvent | null }) {
    const skill = availableSkills[activeSkillIndex];
    if (!quickActionsOpen || !skill)
        return false;

    event?.preventDefault();
    selectSkill(skill);
    return true;
}
