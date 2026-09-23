import { useCallback, useEffect, useRef, useState, type KeyboardEventHandler } from "react";
import { type IntlShape } from "react-intl";
import { BUILT_IN_SKILL, KEY_BINDING_COMMAND, areKeyBindingsEqual, builtInSkillScopeCompatibility, builtInSkills, isBuiltInSkillId, resolveKeyBindings, type AssistantCheckpointComposer, type AssistantSkillSummary, type BuiltInSkillId, type GeneralSettings, type KeyBindingOverrides } from "@skladno/shared";
import { getEventKeyBinding, type KeyBindingDispatcher } from "../../../key-bindings/dispatcher.js";
import type { AssistantComposerValue } from "./AssistantComposer.js";
import { skillMessages } from "./assistant-messages.js";
import type { AssistantSelectionScope } from "../../state/assistant-messages-state.js";
import type { AssistantComposerSkill } from "./AssistantSkillTagNode.js";

type AssistantState = "idle" | "streaming" | "error";


function getSkillAliasKey(skill: BuiltInSkillId) {
    switch (skill) {
        case BUILT_IN_SKILL.TALKING_POINTS:
            return "talkingPoints";
        case BUILT_IN_SKILL.NARRATIVE_DRAFT:
            return "narrativeDraft";
        case BUILT_IN_SKILL.FLOW_AND_CLARITY:
            return "flowAndClarity";
        case BUILT_IN_SKILL.FACT_CHECKING:
            return "factChecking";
        case BUILT_IN_SKILL.STYLE_REVIEW:
            return "styleReview";
        case BUILT_IN_SKILL.SKILL_CREATOR:
            return "skillCreator";
        case BUILT_IN_SKILL.TRANSLATION:
            return "translation";
        default: {
            const unhandledSkill: never = skill;
            return unhandledSkill;
        }
    }
}


function getSlashQueryAt(guidance: string, caretOffset: number): { start: number; query: string } | undefined {
    const start = guidance.lastIndexOf("/", caretOffset - 1);
    if (start < 0 || (start > 0 && !/\s/.test(guidance[start - 1] ?? "")))
        return undefined;

    const query = guidance.slice(start + 1, caretOffset);
    return /\s/.test(query) ? undefined : { start, query };
}


interface AssistantComposerOptions {
    intl: IntlShape;
    state: AssistantState;
    onRequest: (authorMessage: string, skillId?: string, language?: string | readonly string[], skillOffset?: number) => Promise<void>;
    onCancel: () => void;
    translationLanguages: readonly string[];
    authorSkills?: readonly AssistantSkillSummary[];
    loadAuthorSkills?: () => Promise<void>;
    dispatcher?: KeyBindingDispatcher;
    selection?: AssistantSelectionScope;
    clearSelection?: () => void;
    assistantSendMode: GeneralSettings["assistantSendMode"];
    shortcutOverrides: KeyBindingOverrides;
    restoredComposer?: AssistantCheckpointComposer;
}


export function useAssistantComposer({ intl, state, onRequest, onCancel, translationLanguages, authorSkills = [], loadAuthorSkills, dispatcher, selection, clearSelection, assistantSendMode, shortcutOverrides, restoredComposer }: AssistantComposerOptions) {
    const [guidance, setGuidance] = useState("");
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<AssistantComposerSkill>();
    const [skillOffset, setSkillOffset] = useState(0);
    const [slashRange, setSlashRange] = useState<{ start: number; end: number }>();
    const [slashQuery, setSlashQuery] = useState("");
    const [caretOffset, setCaretOffset] = useState(0);
    const [activeSkillIndex, setActiveSkillIndex] = useState(0);
    const [restoredTargetLanguage, setRestoredTargetLanguage] = useState<string>();
    useEffect(() => {
        if (!restoredComposer)
            return;

        setGuidance(restoredComposer.text);
        setSelectedSkill(restoredComposer.skillId ? { id: restoredComposer.skillId, name: isBuiltInSkillId(restoredComposer.skillId) ? intl.formatMessage({ id: skillMessages[restoredComposer.skillId] }) : restoredComposer.skillId } : undefined);
        setSkillOffset(restoredComposer.skillOffset ?? 0);
        setCaretOffset(restoredComposer.text.length);
        setRestoredTargetLanguage(restoredComposer.targetLanguage);
        clearSelection?.();
        window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-assistant-composer]")?.focus());
    }, [clearSelection, intl, restoredComposer]);
    const canSend = state !== "streaming" && Boolean(guidance.trim() || selectedSkill) && (selectedSkill?.id !== BUILT_IN_SKILL.TRANSLATION || translationLanguages.length > 0) && (!selection || !selectedSkill || !isBuiltInSkillId(selectedSkill.id) || builtInSkillScopeCompatibility[selectedSkill.id].includes("selection"));
    const builtInPickerSkills = builtInSkills.map((id) => ({ id, name: intl.formatMessage({ id: skillMessages[id] }) }));
    const pickerSkills = (slashRange === undefined ? builtInPickerSkills : [...builtInPickerSkills, ...authorSkills.map(({ reference, name }) => ({ id: reference.id, name }))]).filter((skill) => {
        const aliases = isBuiltInSkillId(skill.id) ? intl.formatMessage({ id: `assistant.skill.${getSkillAliasKey(skill.id)}.aliases` }) : "";
        const query = slashQuery.toLocaleLowerCase();

        return !query
            || skill.name.toLocaleLowerCase().includes(query)
            || aliases.toLocaleLowerCase().split(",").some((alias) => alias.trim().startsWith(query));
    });

    const slashPickerWasOpen = useRef(false);
    useEffect(() => {
        if (slashRange && !slashPickerWasOpen.current)
            void loadAuthorSkills?.();

        slashPickerWasOpen.current = slashRange !== undefined;
    }, [loadAuthorSkills, slashRange]);


    function focusQuickAction(index: number) {
        if (!pickerSkills.length)
            return;

        const nextIndex = (index + pickerSkills.length) % pickerSkills.length;
        setActiveSkillIndex(nextIndex);
        document.querySelectorAll<HTMLButtonElement>("[data-assistant-skill]")[nextIndex]?.focus();
    }


    const selectSkill = useCallback((skill: AssistantComposerSkill) => {
        const insertionOffset = selectedSkill ? skillOffset : slashRange?.start ?? caretOffset;
        const nextGuidance = slashRange
            ? `${guidance.slice(0, slashRange.start)}${guidance.slice(slashRange.end)}`
            : guidance;
        setQuickActionsOpen(false);
        setSelectedSkill(skill);
        setRestoredTargetLanguage(undefined);
        setSkillOffset(insertionOffset);
        setCaretOffset(insertionOffset);
        setSlashRange(undefined);
        setSlashQuery("");
        setGuidance(nextGuidance);
    }, [caretOffset, guidance, selectedSkill, skillOffset, slashRange]);

    const send = useCallback(() => {
        if (!canSend)
            return;

        const authorMessage = guidance.trim();
        const leadingWhitespace = guidance.length - guidance.trimStart().length;
        const requestSkill = selectedSkill?.id;
        const selectedSkillOffset = requestSkill ? Math.max(0, skillOffset - leadingWhitespace) : undefined;

        setGuidance("");
        setSelectedSkill(undefined);
        void onRequest(authorMessage, requestSkill, requestSkill === BUILT_IN_SKILL.TRANSLATION ? restoredTargetLanguage ?? translationLanguages : undefined, selectedSkillOffset);
        setRestoredTargetLanguage(undefined);
    }, [canSend, guidance, onRequest, restoredTargetLanguage, selectedSkill, skillOffset, translationLanguages]);

    useEffect(() => {
        const unregisterSend = dispatcher?.register(KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, send);
        const unregisterStop = dispatcher?.register(KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, onCancel);
        return () => {
            unregisterSend?.();
            unregisterStop?.();
        };
    }, [dispatcher, onCancel, send]);

    const onChange = useCallback((value: AssistantComposerValue) => {
        setGuidance(value.guidance);
        setSelectedSkill(value.selectedSkill);
        setSkillOffset(value.skillOffset);
        setCaretOffset(value.caretOffset);
        const slash = getSlashQueryAt(value.guidance, value.caretOffset);
        if (slash) {
            setQuickActionsOpen(true);
            setActiveSkillIndex(0);
            setSlashRange({ start: slash.start, end: value.caretOffset });
            setSlashQuery(slash.query);
        } else if (slashRange) {
            setQuickActionsOpen(false);
            setSlashRange(undefined);
            setSlashQuery("");
        }
    }, [slashRange]);

    const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
        if (quickActionsOpen && (event.key === "Enter" || event.key === "Tab") && pickerSkills[activeSkillIndex]) {
            event.preventDefault();
            selectSkill(pickerSkills[activeSkillIndex]);

            return;
        }

        if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
            const primary = event.ctrlKey || event.metaKey;
            const shouldSend = assistantSendMode === "enter" ? !primary : primary;
            const configuredSendBinding = Object.prototype.hasOwnProperty.call(shortcutOverrides, KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST)
                ? resolveKeyBindings(shortcutOverrides)[KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST]
                : undefined;
            const currentBinding = getEventKeyBinding(event);
            const isConfiguredShortcut = configuredSendBinding !== undefined && configuredSendBinding !== null && currentBinding !== undefined && areKeyBindingsEqual(configuredSendBinding, currentBinding);
            if (isConfiguredShortcut)
                return;

            event.stopPropagation();
            if (shouldSend) {
                event.preventDefault();
                send();
            }

            return;
        }

        if (!quickActionsOpen)
            return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusQuickAction(activeSkillIndex + 1);
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            focusQuickAction(activeSkillIndex - 1);
        }

        if (event.key === "Escape") {
            event.preventDefault();
            setQuickActionsOpen(false);
        }
    };

    return {
        canSend,
        guidance,
        selectedSkill,
        skillOffset,
        caretOffset,
        selection,
        clearSelection,
        quickActionsOpen,
        availableSkills: pickerSkills,
        activeSkillIndex,
        incompatibleSelectionSkill: Boolean(selection && selectedSkill && isBuiltInSkillId(selectedSkill.id) && !builtInSkillScopeCompatibility[selectedSkill.id].includes("selection")),
        setQuickActionsOpen,
        setActiveSkillIndex,
        selectSkill,
        focusQuickAction,
        send,
        onChange,
        onKeyDown
    };
}
