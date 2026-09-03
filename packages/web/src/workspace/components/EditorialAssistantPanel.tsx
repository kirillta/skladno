import { useCallback, useEffect, useState, type KeyboardEventHandler } from "react";
import { useIntl, type IntlShape } from "react-intl";
import { BUILT_IN_SKILL, KEY_BINDING_COMMAND, builtInSkillScopeCompatibility, builtInSkills, defaultGeneralSettings, keyBindingsEqual, resolveKeyBindings, type Article, type AssistantCapabilityActivity, type AssistantMessage, type BuiltInSkillId, type FactCheckClaimPreview, type GeneralSettings, type KeyBindingOverrides, type UpdateArticleInput } from "@skladno/shared";
import { Button } from "../../ui/primitives.js";
import { AssistantIcon, ChevronRightIcon } from "../../ui/icons.js";
import { eventKeyBinding, type KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import { AssistantComposer, type AssistantComposerValue } from "./assistant/AssistantComposer.js";
import { AssistantTimeline } from "./assistant/AssistantTimeline.js";
import { skillMessages } from "./assistant/assistant-messages.js";
import type { AssistantSelectionScope } from "../state/assistant-messages-state.js";


type AssistantState = "idle" | "streaming" | "error";


function skillAliasKey(skill: BuiltInSkillId) {
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
        default:
            return "translation";
    }
}


function slashQueryAt(guidance: string, caretOffset: number): { start: number; query: string } | undefined {
    const start = guidance.lastIndexOf("/", caretOffset - 1);
    if (start < 0 || (start > 0 && !/\s/.test(guidance[start - 1] ?? "")))
        return undefined;

    const query = guidance.slice(start + 1, caretOffset);
    return /\s/.test(query) ? undefined : { start, query };
}


function useAssistantComposer({ intl, state, onRequest, onCancel, translationLanguages, dispatcher, selection, clearSelection, assistantSendMode, shortcutOverrides }: {
    intl: IntlShape;
    state: AssistantState;
    onRequest: (authorMessage: string, skillId?: BuiltInSkillId, language?: string | readonly string[], skillOffset?: number) => Promise<void>;
    onCancel: () => void;
    translationLanguages: readonly string[];
    dispatcher?: KeyBindingDispatcher;
    selection?: AssistantSelectionScope;
    clearSelection?: () => void;
    assistantSendMode: GeneralSettings["assistantSendMode"];
    shortcutOverrides: KeyBindingOverrides;
}) {
    const [guidance, setGuidance] = useState("");
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<BuiltInSkillId>();
    const [skillOffset, setSkillOffset] = useState(0);
    const [slashRange, setSlashRange] = useState<{ start: number; end: number }>();
    const [slashQuery, setSlashQuery] = useState("");
    const [caretOffset, setCaretOffset] = useState(0);
    const [activeSkillIndex, setActiveSkillIndex] = useState(0);
    const canSend = state !== "streaming" && Boolean(guidance.trim() || selectedSkill) && (selectedSkill !== BUILT_IN_SKILL.TRANSLATION || translationLanguages.length > 0) && (!selection || !selectedSkill || builtInSkillScopeCompatibility[selectedSkill].includes("selection"));
    const availableSkills = builtInSkills;
    const pickerSkills = slashRange === undefined ? availableSkills : availableSkills.filter((skill) => {
        const aliases = intl.formatMessage({ id: `assistant.skill.${skillAliasKey(skill)}.aliases` });
        const query = slashQuery.toLocaleLowerCase();

        return !query
            || intl.formatMessage({ id: skillMessages[skill] }).toLocaleLowerCase().includes(query)
            || aliases.toLocaleLowerCase().split(",").some((alias) => alias.trim().startsWith(query));
    });


    function focusQuickAction(index: number) {
        if (!pickerSkills.length)
            return;

        const nextIndex = (index + pickerSkills.length) % pickerSkills.length;
        setActiveSkillIndex(nextIndex);
        document.querySelectorAll<HTMLButtonElement>("[data-assistant-skill]")[nextIndex]?.focus();
    }


    const selectSkill = useCallback((skill: BuiltInSkillId) => {
        const insertionOffset = selectedSkill ? skillOffset : slashRange?.start ?? caretOffset;
        const nextGuidance = slashRange
            ? `${guidance.slice(0, slashRange.start)}${guidance.slice(slashRange.end)}`
            : guidance;
        setQuickActionsOpen(false);
        setSelectedSkill(skill);
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
        const requestSkill = selectedSkill;
        const selectedSkillOffset = requestSkill ? Math.max(0, skillOffset - leadingWhitespace) : undefined;

        void onRequest(authorMessage, requestSkill, requestSkill === BUILT_IN_SKILL.TRANSLATION ? translationLanguages : undefined, selectedSkillOffset)
            .then(() => {
                setGuidance("");
                setSelectedSkill(undefined);
            });
    }, [canSend, guidance, onRequest, selectedSkill, skillOffset, translationLanguages]);

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
        const slash = slashQueryAt(value.guidance, value.caretOffset);
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
            const currentBinding = eventKeyBinding(event);
            const isConfiguredShortcut = configuredSendBinding !== undefined && configuredSendBinding !== null && currentBinding !== undefined && keyBindingsEqual(configuredSendBinding, currentBinding);
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

    return { canSend, guidance, selectedSkill, skillOffset, caretOffset, selection, clearSelection, quickActionsOpen, availableSkills: pickerSkills, activeSkillIndex, incompatibleSelectionSkill: Boolean(selection && selectedSkill && !builtInSkillScopeCompatibility[selectedSkill].includes("selection")), setQuickActionsOpen, setActiveSkillIndex, selectSkill, focusQuickAction, send, onChange, onKeyDown };
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


export function EditorialAssistantPanel({ state, message, errorDetails, activity, factCheckClaims, onRequest, onCancel, onRetry, collapsed, setCollapsed, translationLanguages = [], assistantMessages, dispatcher, shortcutOverrides, openView, selection, clearSelection, generalSettings = defaultGeneralSettings, hasUnavailableAiConnection, openSettings }: {
    state: AssistantState;
    message: string;
    errorDetails?: string;
    activity?: AssistantCapabilityActivity;
    factCheckClaims?: FactCheckClaimPreview[];
    onRequest: (authorMessage: string, skillId?: BuiltInSkillId, language?: string | readonly string[], skillOffset?: number) => Promise<void>;
    onCancel: () => void;
    onRetry?: (requestId: string) => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    language?: string;
    translationLanguages?: readonly string[];
    assistantMessages?: AssistantMessage[];
    article?: Article;
    updateArticle?: (articleId: string, input: UpdateArticleInput) => Promise<unknown>;
    dispatcher?: KeyBindingDispatcher;
    shortcutOverrides?: KeyBindingOverrides;
    openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void;
    selection?: AssistantSelectionScope;
    clearSelection?: () => void;
    generalSettings?: GeneralSettings;
    hasUnavailableAiConnection?: boolean;
    openSettings?: () => void;
}) {
    const intl = useIntl();
    const composerState = useAssistantComposer({ intl, state, onRequest, onCancel, translationLanguages, dispatcher, selection, clearSelection, assistantSendMode: generalSettings.assistantSendMode, shortcutOverrides: shortcutOverrides ?? {} });
    const elapsedDuration = useElapsedDuration(state, intl);

    if (collapsed)
        return <aside data-workspace-panel="editorial-assistant" className="flex h-full w-full flex-col border-l border-border bg-surface-supporting p-1" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
            <header className="flex min-h-18 w-full items-center justify-center"><Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.expand" })} onClick={() => setCollapsed(false)}><AssistantIcon className="size-5 text-brand" /></Button></header>
        </aside>;

    return <aside data-workspace-panel="editorial-assistant" className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
        <header className="flex min-h-18 items-center border-b border-border px-5">
            <AssistantIcon className="size-5 shrink-0 text-brand" />
            <h2 className="ml-3 text-base font-semibold">{intl.formatMessage({ id: "assistant.heading" })}</h2>
            <Button className="ml-auto inline-grid size-9 place-items-center p-1" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.collapse" }), KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}>
                <ChevronRightIcon className="size-3" />
            </Button>
        </header>
        <AssistantTimeline state={state} message={message} errorDetails={errorDetails} activity={activity} factCheckClaims={factCheckClaims} collapsed={collapsed} assistantMessages={assistantMessages} openView={openView} onRetry={onRetry} generalSettings={generalSettings} elapsedDuration={elapsedDuration} hasUnavailableAiConnection={hasUnavailableAiConnection} openSettings={openSettings} />
        <AssistantComposer {...composerState} state={state} selection={selection} onCancel={onCancel} shortcutOverrides={shortcutOverrides} />
    </aside>;
}
