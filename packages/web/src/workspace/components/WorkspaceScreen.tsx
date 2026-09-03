import type { GeneralSettings, KeyBindingOverrides } from "@skladno/shared";
import type { ReactNode } from "react";

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


export function WorkspaceScreen({ layout, workspace, assistant, editorial, revisions, corpus, publishing, generalSettings, createBlank, runFactCheck, runTranslation, dispatcher, shortcutOverrides, openSettings, assistantSelection, onSelectionChange, clearAssistantSelection, overlays }: {
    layout: WorkspaceLayoutState;
    workspace: ArticleWorkspaceState;
    assistant: AssistantMessagesState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    generalSettings: GeneralSettings;
    createBlank: () => Promise<unknown>;
    runFactCheck: () => void;
    runTranslation: () => void;
    dispatcher: KeyBindingDispatcher;
    shortcutOverrides: KeyBindingOverrides;
    openSettings: () => void;
    assistantSelection: AssistantSelectionScope | undefined;
    onSelectionChange: (snapshot: AssistantSelectionSnapshot | undefined) => void;
    clearAssistantSelection: () => void;
    overlays: ReactNode;
}) {
    return <WorkspaceShell
        focusMode={layout.focusMode}
        libraryCollapsed={layout.libraryCollapsed}
        setLibraryCollapsed={layout.setLibraryCollapsed}
        assistantCollapsed={layout.assistantCollapsed}
        setAssistantCollapsed={layout.setAssistantCollapsed}
        libraryWidth={layout.libraryWidth}
        setLibraryWidth={layout.setLibraryWidth}
        assistantWidth={layout.assistantWidth}
        setAssistantWidth={layout.setAssistantWidth}
        library={<ArticleLibraryPanel
            articles={workspace.articles}
            selectedArticleId={workspace.selectedArticleId}
            selectArticle={workspace.selectArticle}
            collapsed={layout.libraryCollapsed}
            setCollapsed={layout.setLibraryCollapsed}
            createBlank={createBlank}
            openStyleProfile={() => layout.setView("style-profile")}
            openSettings={openSettings}
            language={workspace.selectedArticle?.language}
            saveState={workspace.saveState}
            dispatcher={dispatcher}
            shortcutOverrides={shortcutOverrides} />}
        assistant={<EditorialAssistantPanel
            state={assistant.state}
            message={assistant.message}
            errorDetails={assistant.errorDetails}
            hasUnavailableAiConnection={assistant.hasUnavailableAiConnection}
            activity={assistant.activity}
            factCheckClaims={assistant.factCheckClaims ?? editorial.factCheck?.findings.map(({ claim }) => ({ claim, checked: true }))}
            onRequest={assistant.request}
            onCancel={assistant.cancel}
            onRetry={assistant.retry}
            collapsed={layout.assistantCollapsed}
            setCollapsed={layout.setAssistantCollapsed}
            translationLanguages={generalSettings.defaultTranslationLanguages.filter((language) => language !== workspace.selectedArticle?.language)}
            assistantMessages={assistant.messages}
            dispatcher={dispatcher}
            shortcutOverrides={shortcutOverrides}
            selection={assistantSelection}
            openView={layout.setView}
            generalSettings={generalSettings}
            openSettings={openSettings}
            clearSelection={clearAssistantSelection} />}
    >
        <ArticleWorkspace workspace={workspace} layout={layout} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} generalSettings={generalSettings} createBlank={createBlank} runFactCheck={runFactCheck} runTranslation={runTranslation} shortcutOverrides={shortcutOverrides} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection?.preview} />
        {overlays}
    </WorkspaceShell>;
}
