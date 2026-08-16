import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { BUILT_IN_SKILL, defaultPublishLimitProfileId, isArticleLanguage, isPublishLimitProfileId, KEY_BINDING_COMMAND, type KeyBindingOverrides } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Banner } from "../ui/primitives.js";
import { ApplicationSettings } from "../settings/ApplicationSettings.js";
import { useNotifications } from "../notifications/NotificationProvider.js";
import type { KeyBindingDispatcher } from "../key-bindings/dispatcher.js";
import { EditorialAssistantPanel as ExtractedEditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { ArticleLibraryPanel as ExtractedArticleLibraryPanel } from "./components/ArticleLibraryPanel.js";
import { ArticleWorkspace as ExtractedArticleWorkspace } from "./components/ArticleWorkspace.js";
import { DraftConflictDialog } from "./components/DraftConflictDialog.js";
import { RestoreRevisionDialog as ExtractedRestoreRevisionDialog } from "./components/RestoreRevisionDialog.js";
import { WorkspaceShell as ExtractedWorkspaceShell } from "./components/WorkspaceShell.js";
import { useWorkspaceLayout, type WorkspaceLayoutState } from "./state/useWorkspaceLayout.js";
import { useWorkspaceGeneralSettings } from "./state/useWorkspaceGeneralSettings.js";
import { useArticleWorkspace, articleContentForWorkspace, sortArticlesByActivity, type ArticleWorkspaceState } from "./state/article-workspace-state.js";
import { useArticleRevisions, type ArticleRevisionsState } from "./state/article-revisions-state.js";
import { useEditorialProposal, type EditorialProposalState } from "./state/editorial-proposal-state.js";
import { useStyleCorpus, type StyleCorpusState } from "./state/style-corpus-state.js";
import { useAssistantMessages, type AssistantMessagesState } from "./state/assistant-messages-state.js";
import { usePublishing, type PublishingState } from "./state/publishing-state.js";

export type { DraftConflict, DraftPresentationState as SaveState } from "./drafts/draft-lifecycle.js";
export type { WorkspaceView } from "./workspace-views.js";
export { articleContentForWorkspace, sortArticlesByActivity };
export type { ArticleWorkspaceState, ArticleRevisionsState, EditorialProposalState, StyleCorpusState, PublishingState, WorkspaceLayoutState, AssistantMessagesState };


export function EditorialWorkspaceProvider({ client, screen, openSettings, backToWorkspace, dispatcher, keyBindingOverrides, onKeyBindingsUpdated }: { client: EditorialWorkspaceClient; screen: "editorial-workspace" | "application-settings"; openSettings: () => void; backToWorkspace: () => void; dispatcher: KeyBindingDispatcher; keyBindingOverrides: KeyBindingOverrides; onKeyBindingsUpdated: (overrides: KeyBindingOverrides) => void }) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const layout = useWorkspaceLayout();
    const workspace = useArticleWorkspace(client, layout.selectedArticleId, layout.setSelectedArticleId);
    const generalSettings = useWorkspaceGeneralSettings(client, screen);
    const revisions = useArticleRevisions(client, workspace.selectedArticle, workspace.updateRevision, workspace.save, workspace.discardDraft);
    const editorial = useEditorialProposal(client, workspace);
    const [profileRebuilt, setProfileRebuilt] = useState<{ articleId: string; count: number; token: number }>();
    const corpus = useStyleCorpus(client, (count) => {
        if (workspace.selectedArticle)
            setProfileRebuilt({ articleId: workspace.selectedArticle.id, count, token: Date.now() });
    });
    const [assistantSelection, setAssistantSelection] = useState<string>();
    const applyAssistantResult = useCallback((articleId: string, baseRevisionId: string, result: import("@skladno/shared").AssistantEditorialResult, editorialArtifactId?: string) => {
        editorial.applyAssistantResult(articleId, baseRevisionId, result, editorialArtifactId);
        if (result.proposal)
            layout.setView("proposal");
    }, [editorial, layout]);
    const assistant = useAssistantMessages(client, workspace, assistantSelection, applyAssistantResult, profileRebuilt);
    const publishing = usePublishing(client, workspace.selectedArticle, workspace.content, workspace.updateArticle);
    const restoreAssistantProposal = editorial.restoreAssistantProposal;
    const runFactCheck = () => {
        layout.setAssistantCollapsed(false);
        void assistant.request("", BUILT_IN_SKILL.FACT_CHECKING);
    };
    const runTranslation = () => {
        const languages = generalSettings.defaultTranslationLanguages.filter((language) => language !== workspace.selectedArticle?.language);
        if (!languages.length)
            return;

        layout.setAssistantCollapsed(false);
        void assistant.request("", BUILT_IN_SKILL.TRANSLATION, languages);
    };

    useEffect(() => {
        restoreAssistantProposal(assistant.messages);
    }, [assistant.messages, restoreAssistantProposal]);

    const createBlank = useCallback(async () => {
        try {
            const settings = await client.getApplicationSettings();
            const defaultLanguage = settings.general.defaultArticleLanguage;
            const defaultProfileId = await client.getPublishLimitProfile();
            return await workspace.create({
                title: intl.formatMessage({ id: "article.defaultTitle" }),
                content: "",
                language: isArticleLanguage(defaultLanguage) ? defaultLanguage : "en",
                publishingProfileId: isPublishLimitProfileId(defaultProfileId) ? defaultProfileId : defaultPublishLimitProfileId,
            });
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }, [client, intl, notifyError, workspace]);

    const enterSettings = useCallback(() => {
        void workspace.flushSelected().catch(() => undefined);
        openSettings();
    }, [openSettings, workspace]);

    const shortcutActions = useRef({
        createBlank,
        save: workspace.save,
        enterSettings,
        setFocusMode: layout.setFocusMode,
        libraryCollapsed: layout.libraryCollapsed,
        setLibraryCollapsed: layout.setLibraryCollapsed,
        assistantCollapsed: layout.assistantCollapsed,
        setAssistantCollapsed: layout.setAssistantCollapsed,
        setView: layout.setView,
    });
    shortcutActions.current = {
        createBlank,
        save: workspace.save,
        enterSettings,
        setFocusMode: layout.setFocusMode,
        libraryCollapsed: layout.libraryCollapsed,
        setLibraryCollapsed: layout.setLibraryCollapsed,
        assistantCollapsed: layout.assistantCollapsed,
        setAssistantCollapsed: layout.setAssistantCollapsed,
        setView: layout.setView,
    };

    useLayoutEffect(() => {
        if (screen !== "editorial-workspace")
            return;


        function toggleFocusMode() {
            const activeElement = document.activeElement;
            const focusWillBeLost = !(activeElement instanceof HTMLElement)
                || activeElement === document.body
                || Boolean(activeElement.closest("[data-workspace-panel]"));

            if (focusWillBeLost)
                document.querySelector<HTMLElement>("[data-article-workspace]")?.focus({ preventScroll: true });

            shortcutActions.current.setFocusMode((current) => !current);
        }


        const unregister = [
            dispatcher.register(KEY_BINDING_COMMAND.NEW_ARTICLE, () => void shortcutActions.current.createBlank()),
            dispatcher.register(KEY_BINDING_COMMAND.SAVE_REVISION, () => void shortcutActions.current.save().catch(() => undefined)),
            dispatcher.register(KEY_BINDING_COMMAND.OPEN_SETTINGS, () => shortcutActions.current.enterSettings()),
            dispatcher.register(KEY_BINDING_COMMAND.TOGGLE_FOCUS_MODE, toggleFocusMode),
            dispatcher.register(KEY_BINDING_COMMAND.TOGGLE_ARTICLE_LIBRARY, () => shortcutActions.current.setLibraryCollapsed(!shortcutActions.current.libraryCollapsed)),
            dispatcher.register(KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, () => shortcutActions.current.setAssistantCollapsed(!shortcutActions.current.assistantCollapsed)),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_WRITE, () => shortcutActions.current.setView("write")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_PROPOSAL, () => shortcutActions.current.setView("proposal")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_REVISIONS, () => shortcutActions.current.setView("revisions")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_FACT_CHECK, () => shortcutActions.current.setView("fact-check")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_STYLE_PROFILE, () => shortcutActions.current.setView("style-profile")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_TRANSLATIONS, () => shortcutActions.current.setView("translations")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_PUBLISH, () => shortcutActions.current.setView("publish")),
        ];

        return () => unregister.forEach((remove) => remove());
    }, [dispatcher, screen]);

    if (workspace.state === "loading")
        return <main className="grid min-h-screen place-items-center text-muted">
            {intl.formatMessage({ id: "workspace.loadingArticles" })}
        </main>;

    if (workspace.state === "error")
        return <main className="grid min-h-screen place-items-center">
            <Banner tone="error" role="alert">{workspace.message}</Banner>
        </main>;

    if (screen === "application-settings")
        return <ApplicationSettings client={client} back={backToWorkspace} onKeyBindingsUpdated={onKeyBindingsUpdated} />;

    return <ExtractedWorkspaceShell
        focusMode={layout.focusMode}
        libraryCollapsed={layout.libraryCollapsed}
        setLibraryCollapsed={layout.setLibraryCollapsed}
        assistantCollapsed={layout.assistantCollapsed}
        setAssistantCollapsed={layout.setAssistantCollapsed}
        libraryWidth={layout.libraryWidth}
        setLibraryWidth={layout.setLibraryWidth}
        assistantWidth={layout.assistantWidth}
        setAssistantWidth={layout.setAssistantWidth}
        library={<ExtractedArticleLibraryPanel
            articles={workspace.articles}
            selectedArticleId={workspace.selectedArticleId}
            selectArticle={workspace.selectArticle}
            collapsed={layout.libraryCollapsed}
            setCollapsed={layout.setLibraryCollapsed}
            createBlank={createBlank}
            openStyleProfile={() => layout.setView("style-profile")}
            openSettings={enterSettings}
            language={workspace.selectedArticle?.language}
            saveState={workspace.saveState}
            dispatcher={dispatcher}
            shortcutOverrides={keyBindingOverrides} />
        }
        assistant={<ExtractedEditorialAssistantPanel
            state={assistant.state}
            message={assistant.message}
            errorDetails={assistant.errorDetails}
            factCheckClaims={assistant.factCheckClaims ?? editorial.factCheck?.findings.map(({ claim }) => ({ claim, checked: true }))}
            onRequest={assistant.request}
            onCancel={assistant.cancel}
            collapsed={layout.assistantCollapsed}
            setCollapsed={layout.setAssistantCollapsed}
            translationLanguages={generalSettings.defaultTranslationLanguages.filter((language) => language !== workspace.selectedArticle?.language)}
            assistantMessages={assistant.messages}
            dispatcher={dispatcher}
            shortcutOverrides={keyBindingOverrides}
            selection={assistantSelection}
            openView={layout.setView}
            generalSettings={generalSettings}
            clearSelection={() => setAssistantSelection(undefined)} />
        }>
        <ExtractedArticleWorkspace workspace={workspace} layout={layout} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} generalSettings={generalSettings} createBlank={createBlank} runFactCheck={runFactCheck} runTranslation={runTranslation} shortcutOverrides={keyBindingOverrides} onSelectionChange={setAssistantSelection} assistantSelection={assistantSelection} />
        <ExtractedRestoreRevisionDialog candidate={revisions.candidate} hasUncommittedChanges={workspace.hasUncommittedChanges} close={() => revisions.setCandidate(undefined)} restore={revisions.restore} />
        <DraftConflictDialog conflict={workspace.conflict} open={Boolean(workspace.comparisonArticleId)} close={workspace.closeComparison} resolve={workspace.resolveConflict} />
    </ExtractedWorkspaceShell>;
}
