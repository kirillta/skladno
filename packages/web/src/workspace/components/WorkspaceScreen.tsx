import type { AssistantSkillSummary, GeneralSettings, KeyBindingOverrides } from "@skladno/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import type { AssistantSelectionSnapshot } from "../editor/ArticleEditorPlugins.js";
import type { ArticleRevisionsState } from "../state/article-revisions-state.js";
import type { ArticleWorkspaceState } from "../state/article-workspace-state.js";
import type { AssistantMessagesState, AssistantSelectionScope } from "../state/assistant-messages-state.js";
import type { EditorialProposalState } from "../state/editorial-proposal-state.js";
import type { PublishingState } from "../state/publishing-state.js";
import type { StyleCorpusState } from "../state/style-corpus-state.js";
import type { WorkspaceLayoutState } from "../state/useWorkspaceLayout.js";
import { ArticleLibraryPanel } from "./ArticleLibraryPanel.js";
import { ArticleWorkspace } from "./ArticleWorkspace.js";
import { EditorialAssistantPanel } from "./EditorialAssistantPanel.js";
import { WorkspaceShell } from "./WorkspaceShell.js";
import { Banner, Button } from "../../ui/primitives.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";


interface WorkspaceScreenContent {
    layout: WorkspaceLayoutState;
    workspace: ArticleWorkspaceState;
    assistant: AssistantMessagesState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    generalSettings: GeneralSettings;
    authorSkills: readonly AssistantSkillSummary[];
}


interface WorkspaceScreenActions {
    createBlank: () => Promise<unknown>;
    runFactCheck: () => void;
    runTranslation: () => void;
    rejectTranslation: (targetLanguage: string) => Promise<void>;
    openSettings: () => void;
    openModelSettings: () => void;
}


interface WorkspaceScreenEnvironment {
    dispatcher: KeyBindingDispatcher;
    shortcutOverrides: KeyBindingOverrides;
    hasUsableAiConnection: boolean | undefined;
    loadAuthorSkills: () => Promise<void>;
    overlays: ReactNode;
}


interface WorkspaceScreenSelection {
    assistantSelection: AssistantSelectionScope | undefined;
    onSelectionChange: (snapshot: AssistantSelectionSnapshot | undefined) => void;
    clearAssistantSelection: () => void;
}


export function WorkspaceScreen({ content, actions, environment, selection }: {
    content: WorkspaceScreenContent;
    actions: WorkspaceScreenActions;
    environment: WorkspaceScreenEnvironment;
    selection: WorkspaceScreenSelection;
}) {
    const { layout, workspace, assistant, editorial, revisions, corpus, publishing, generalSettings, authorSkills } = content;
    const { createBlank, runFactCheck, runTranslation, rejectTranslation, openSettings, openModelSettings } = actions;
    const { dispatcher, shortcutOverrides, hasUsableAiConnection, loadAuthorSkills, overlays } = environment;
    const { assistantSelection, onSelectionChange, clearAssistantSelection } = selection;
    const { notifyError } = useNotifications();
    return <WorkspaceShell
        layout={{
            focusMode: layout.focusMode,
            libraryCollapsed: layout.libraryCollapsed,
            setLibraryCollapsed: layout.setLibraryCollapsed,
            assistantCollapsed: layout.assistantCollapsed,
            setAssistantCollapsed: layout.setAssistantCollapsed,
            assistantOpenRequest: layout.assistantOpenRequest,
            libraryWidth: layout.libraryWidth,
            setLibraryWidth: layout.setLibraryWidth,
            assistantWidth: layout.assistantWidth,
            setAssistantWidth: layout.setAssistantWidth,
        }}
        content={{
            library: <ArticleLibraryPanel
                data={{ articles: workspace.articles, selectedArticleId: workspace.selectedArticleId, collapsed: layout.libraryCollapsed, language: workspace.selectedArticle?.language }}
                navigation={{ selectArticle: workspace.selectArticle, setCollapsed: layout.setLibraryCollapsed, createBlank, openStyleProfile: () => layout.setView("style-profile"), openSettings, dispatcher, shortcutOverrides }}
                mutations={{ remove: workspace.remove, setArchived: workspace.setArchived, setPinned: workspace.setPinned, reorderPinned: workspace.reorderPinned, notifyError }} />,
            assistant: <EditorialAssistantPanel
                data={{
                    state: assistant.state,
                    message: assistant.message,
                    errorDetails: assistant.errorDetails,
                    hasUnavailableAiConnection: assistant.hasUnavailableAiConnection,
                    streamedMessage: assistant.streamedMessage,
                    activity: assistant.activity,
                    factCheckClaims: assistant.factCheckClaims ?? editorial.factCheck?.findings.map(({ claim }) => ({ claim, checked: true })),
                    translationLanguages: generalSettings.defaultTranslationLanguages.filter((language) => language !== workspace.selectedArticle?.language),
                    assistantMessages: assistant.messages,
                    selection: assistantSelection,
                    generalSettings,
                    checkpointPreview: assistant.checkpointPreview,
                    restoredComposer: assistant.restoredComposer,
                    authorSkills,
                }}
                actions={{ onRequest: assistant.request, onCancel: assistant.cancel, onRetry: assistant.retry, loadAuthorSkills, dispatcher, shortcutOverrides, openView: layout.setView, openSettings, clearSelection: clearAssistantSelection, previewCheckpoint: assistant.previewCheckpoint, restoreCheckpoint: assistant.restoreCheckpoint, closeCheckpoint: assistant.closeCheckpoint }}
                layout={{ collapsed: layout.assistantCollapsed, setCollapsed: layout.setAssistantCollapsed }} />,
            children: <>
                {hasUsableAiConnection === false && <AiConnectionWarning openModelSettings={openModelSettings} />}
                <ArticleWorkspace state={{ workspace, layout, editorial, revisions, corpus, publishing, generalSettings }} actions={{ createBlank, runFactCheck, runTranslation, rejectTranslation, shortcutOverrides, onSelectionChange, assistantSelection: assistantSelection?.preview }} />
                {overlays}
            </>,
        }}
    />;
}


function AiConnectionWarning({ openModelSettings }: { openModelSettings: () => void }) {
    const intl = useIntl();

    return <Banner data-focus-area="workspace-views" className="m-3 shrink-0" tone="warning" role="status">
        <span className="min-w-0">
            <strong className="block">{intl.formatMessage({ id: "workspace.aiConnectionRequired" })}</strong>
            {intl.formatMessage({ id: "workspace.aiConnectionCapabilities" })}</span>
        <Button className="ml-auto shrink-0" variant="secondary" onClick={openModelSettings}>{intl.formatMessage({ id: "workspace.addModelKey" })}</Button>
    </Banner>;
}
