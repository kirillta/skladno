import { useCallback, useEffect, useRef, useState, type KeyboardEventHandler } from "react";
import { useIntl, type IntlShape } from "react-intl";
import { BUILT_IN_SKILL, KEY_BINDING_COMMAND, areKeyBindingsEqual, builtInSkillScopeCompatibility, builtInSkills, defaultGeneralSettings, isBuiltInSkillId, resolveKeyBindings, type AssistantCapabilityActivity, type AssistantCheckpointComposer, type AssistantCheckpointDraftMode, type AssistantCheckpointPreview, type AssistantMessage, type AssistantSkillSummary, type BuiltInSkillId, type FactCheckClaimPreview, type GeneralSettings, type KeyBindingOverrides } from "@skladno/shared";
import { Button } from "../../ui/primitives.js";
import { AssistantIcon, ChevronRightIcon } from "../../ui/icons.js";
import { getEventKeyBinding, type KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { getShortcutHint } from "../../key-bindings/shortcut-hint.js";
import { AssistantComposer, type AssistantComposerValue } from "./assistant/AssistantComposer.js";
import { AssistantTimeline } from "./assistant/AssistantTimeline.js";
import { skillMessages } from "./assistant/assistant-messages.js";
import type { AssistantSelectionScope, StreamedAssistantMessage } from "../state/assistant-messages-state.js";
import { AssistantCheckpointDialog } from "./assistant/AssistantCheckpointDialog.js";
import type { AssistantComposerSkill } from "./assistant/AssistantSkillTagNode.js";


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


function useAssistantComposer({ intl, state, onRequest, onCancel, translationLanguages, authorSkills = [], loadAuthorSkills, dispatcher, selection, clearSelection, assistantSendMode, shortcutOverrides, restoredComposer }: {
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
}) {
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


function useElapsedDuration(state: AssistantState, intl: IntlShape) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (state !== "streaming") {
            setElapsedSeconds(0);
            return;
        }

        const startedAt = Date.now();
        const interval = window.setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
        }, 1_000);

        return () => window.clearInterval(interval);
    }, [state]);

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    return elapsedMinutes > 0
        ? intl.formatMessage({ id: "assistant.duration.minutesAndSeconds" }, { minutes: elapsedMinutes, seconds: elapsedSeconds % 60 })
        : intl.formatMessage({ id: "assistant.duration.seconds" }, { seconds: elapsedSeconds });
}


interface EditorialAssistantData {
    state: AssistantState;
    message: string;
    errorDetails?: string;
    activity?: AssistantCapabilityActivity;
    factCheckClaims?: FactCheckClaimPreview[];
    translationLanguages?: readonly string[];
    assistantMessages?: AssistantMessage[];
    streamedMessage?: StreamedAssistantMessage;
    selection?: AssistantSelectionScope;
    generalSettings?: GeneralSettings;
    hasUnavailableAiConnection?: boolean;
    checkpointPreview?: AssistantCheckpointPreview;
    restoredComposer?: AssistantCheckpointComposer;
    authorSkills?: readonly AssistantSkillSummary[];
}


interface EditorialAssistantActions {
    onRequest: (authorMessage: string, skillId?: string, language?: string | readonly string[], skillOffset?: number) => Promise<void>;
    loadAuthorSkills?: () => Promise<void>;
    onCancel: () => void;
    onRetry?: (requestId: string) => void;
    dispatcher?: KeyBindingDispatcher;
    shortcutOverrides?: KeyBindingOverrides;
    openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void;
    clearSelection?: () => void;
    openSettings?: () => void;
    previewCheckpoint?: (messageId: string) => Promise<void>;
    restoreCheckpoint?: (mode?: AssistantCheckpointDraftMode) => Promise<unknown>;
    closeCheckpoint?: () => void;
}


interface EditorialAssistantLayout {
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
}


export function EditorialAssistantPanel({ data, actions, layout }: { data: EditorialAssistantData; actions: EditorialAssistantActions; layout: EditorialAssistantLayout }) {
    const { state, message, errorDetails, activity, factCheckClaims, translationLanguages = [], assistantMessages, streamedMessage, selection, generalSettings = defaultGeneralSettings, hasUnavailableAiConnection, checkpointPreview, restoredComposer, authorSkills } = data;
    const { onRequest, onCancel, onRetry, loadAuthorSkills, dispatcher, shortcutOverrides, openView, clearSelection, openSettings, previewCheckpoint, restoreCheckpoint, closeCheckpoint } = actions;
    const { collapsed, setCollapsed } = layout;
    const intl = useIntl();
    const composerState = useAssistantComposer({ intl, state, onRequest, onCancel, translationLanguages, authorSkills, loadAuthorSkills, dispatcher, selection, clearSelection, assistantSendMode: generalSettings.assistantSendMode, shortcutOverrides: shortcutOverrides ?? {}, restoredComposer });
    const elapsedDuration = useElapsedDuration(state, intl);
    const checkpointOrigin = useRef<HTMLElement>();
    const openCheckpoint = useCallback((messageId: string) => {
        checkpointOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        return previewCheckpoint?.(messageId);
    }, [previewCheckpoint]);
    const closeCheckpointAndRestoreFocus = useCallback(() => {
        closeCheckpoint?.();
        checkpointOrigin.current?.focus();
    }, [closeCheckpoint]);

    if (collapsed)
        return <aside data-workspace-panel="editorial-assistant" data-focus-area="assistant-chat" className="flex h-full min-w-0 w-full flex-col border-l border-border bg-surface-supporting p-1" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
            <header className="flex min-h-18 w-full items-center justify-center"><Button data-focus-area-entry className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.expand" })} onClick={() => setCollapsed(false)}><AssistantIcon className="size-5 text-brand" /></Button></header>
        </aside>;

    return <aside data-workspace-panel="editorial-assistant" className="flex h-full min-h-0 min-w-0 w-full flex-col border-l border-border bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
        <header className="flex min-h-18 items-center gap-3 border-b border-border px-5">
            <Button className="inline-grid size-9 place-items-center p-1" variant="quiet" title={getShortcutHint(intl.formatMessage({ id: "assistant.collapse" }), KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}>
                <ChevronRightIcon className="size-3" />
            </Button>
            <AssistantIcon className="size-5 shrink-0 text-brand" />
            <h2 className="text-base font-semibold text-brand">{intl.formatMessage({ id: "assistant.heading" })}</h2>
        </header>
        <AssistantTimeline data={{ state, message, errorDetails, activity, factCheckClaims, collapsed, assistantMessages, streamedMessage, generalSettings, elapsedDuration, hasUnavailableAiConnection }} actions={{ openView, onRetry, openSettings, onCheckpoint: openCheckpoint }} />
        <AssistantComposer
            state={{ state, canSend: composerState.canSend, guidance: composerState.guidance, selectedSkill: composerState.selectedSkill, skillOffset: composerState.skillOffset, caretOffset: composerState.caretOffset, selection, clearSelection, incompatibleSelectionSkill: composerState.incompatibleSelectionSkill }}
            picker={{ quickActionsOpen: composerState.quickActionsOpen, availableSkills: composerState.availableSkills, activeSkillIndex: composerState.activeSkillIndex, setQuickActionsOpen: composerState.setQuickActionsOpen, setActiveSkillIndex: composerState.setActiveSkillIndex, selectSkill: composerState.selectSkill, focusQuickAction: composerState.focusQuickAction }}
            actions={{ send: composerState.send, onCancel, onChange: composerState.onChange, onKeyDown: composerState.onKeyDown, shortcutOverrides }} />
        {checkpointPreview && restoreCheckpoint && closeCheckpoint && <AssistantCheckpointDialog preview={checkpointPreview} replacingComposer={Boolean(composerState.guidance || composerState.selectedSkill)} close={closeCheckpointAndRestoreFocus} restore={restoreCheckpoint} />}
    </aside>;
}
