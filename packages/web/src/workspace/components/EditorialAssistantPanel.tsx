import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl, type IntlShape } from "react-intl";
import { KEY_BINDING_COMMAND, defaultGeneralSettings, type AssistantCapabilityActivity, type AssistantCheckpointComposer, type AssistantCheckpointDraftMode, type AssistantCheckpointPreview, type AssistantMessage, type AssistantSkillSummary, type FactCheckClaimPreview, type GeneralSettings, type KeyBindingOverrides } from "@skladno/shared";
import { Button } from "../../ui/primitives.js";
import { AssistantIcon, ChevronRightIcon } from "../../ui/icons.js";
import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { getShortcutHint } from "../../key-bindings/shortcut-hint.js";
import { AssistantComposer } from "./assistant/AssistantComposer.js";
import { AssistantTimeline } from "./assistant/AssistantTimeline.js";
import type { AssistantSelectionScope, StreamedAssistantMessage } from "../state/assistant-messages-state.js";
import { AssistantCheckpointDialog } from "./assistant/AssistantCheckpointDialog.js";
import { useAssistantComposer } from "./assistant/use-assistant-composer.js";


type AssistantState = "idle" | "streaming" | "error";


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
    openSkillFolder?: (requestId: string) => void;
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
    const { onRequest, onCancel, onRetry, loadAuthorSkills, dispatcher, shortcutOverrides, openView, openSkillFolder, clearSelection, openSettings, previewCheckpoint, restoreCheckpoint, closeCheckpoint } = actions;
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
        <AssistantTimeline data={{ state, message, errorDetails, activity, factCheckClaims, collapsed, assistantMessages, streamedMessage, generalSettings, elapsedDuration, hasUnavailableAiConnection }} actions={{ openView, openSkillFolder, onRetry, openSettings, onCheckpoint: openCheckpoint }} />
        <AssistantComposer
            state={{ state, canSend: composerState.canSend, guidance: composerState.guidance, selectedSkill: composerState.selectedSkill, skillOffset: composerState.skillOffset, caretOffset: composerState.caretOffset, selection, clearSelection, incompatibleSelectionSkill: composerState.incompatibleSelectionSkill }}
            picker={{ quickActionsOpen: composerState.quickActionsOpen, availableSkills: composerState.availableSkills, activeSkillIndex: composerState.activeSkillIndex, setQuickActionsOpen: composerState.setQuickActionsOpen, setActiveSkillIndex: composerState.setActiveSkillIndex, selectSkill: composerState.selectSkill, focusQuickAction: composerState.focusQuickAction }}
            actions={{ send: composerState.send, onCancel, onChange: composerState.onChange, onKeyDown: composerState.onKeyDown, shortcutOverrides }} />
        {checkpointPreview && restoreCheckpoint && closeCheckpoint && <AssistantCheckpointDialog preview={checkpointPreview} replacingComposer={Boolean(composerState.guidance || composerState.selectedSkill)} close={closeCheckpointAndRestoreFocus} restore={restoreCheckpoint} />}
    </aside>;
}
