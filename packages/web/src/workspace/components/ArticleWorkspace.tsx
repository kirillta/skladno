import { Banner, Button, EmptyState } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { ArticleRevisionsState, ArticleWorkspaceState, EditorialProposalState, PublishingState, StyleCorpusState, WorkspaceLayoutState } from "../EditorialWorkspace.js";
import { ArticleHeader } from "./ArticleHeader.js";
import { ArticleStatusBar } from "./ArticleStatusBar.js";
import { WorkspaceTabBar } from "./WorkspaceTabBar.js";
import { WorkspaceViewRouter } from "./WorkspaceViewRouter.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import type { KeyBindingOverrides } from "@skladno/shared";
import { KEY_BINDING_COMMAND } from "@skladno/shared";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";

export function ArticleWorkspace({ workspace, layout, editorial, revisions, corpus, publishing, createBlank, shortcutOverrides }: {
    workspace: ArticleWorkspaceState;
    layout: WorkspaceLayoutState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    createBlank: () => Promise<unknown>;
    shortcutOverrides?: KeyBindingOverrides;
}) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const article = workspace.selectedArticle;

    if (!article)
        return <EmptyState title={intl.formatMessage({ id: "navigation.noArticlesYet" })} className="pt-40">
            <Button title={shortcutHint(intl.formatMessage({ id: "articleWorkspace.create" }), KEY_BINDING_COMMAND.NEW_ARTICLE, shortcutOverrides)} onClick={() => void createBlank()}>{intl.formatMessage({ id: "articleWorkspace.create" })}</Button>
        </EmptyState>;

    const revisionIndex = revisions.revisions.findIndex((revision) => revision.id === article.currentRevisionId);
    const revisionNumber = revisionIndex < 0 ? 1 : revisionIndex + 1;

    return <div className="flex h-full min-h-0 flex-col overflow-hidden" data-article-workspace tabIndex={-1}>
        <ArticleHeader article={article}
            updateArticle={workspace.updateArticle}
            save={workspace.save}
            remove={workspace.remove}
            focusMode={layout.focusMode}
            setFocusMode={layout.setFocusMode}
            language={layout.targetLanguage}
            setLanguage={layout.setTargetLanguage}
            notifyError={notifyError}
            shortcutOverrides={shortcutOverrides}
        />
        {workspace.conflict && <Banner className="m-3" tone="error" role="alert">
            <span>{intl.formatMessage({ id: "draftConflict.banner" })}</span>
            <Button className="ml-auto" variant="secondary" onClick={workspace.openComparison}>{intl.formatMessage({ id: "draftConflict.compare" })}</Button>
        </Banner>}
        {workspace.saveState === "error" && <Banner className="m-3" tone="warning" role="alert">
            <span>{intl.formatMessage({ id: "draftSave.failure" })}</span>
            <Button className="ml-auto" variant="secondary" onClick={() => void workspace.retry()}>{intl.formatMessage({ id: "draftSave.retry" })}</Button>
        </Banner>}
        <WorkspaceTabBar view={layout.view} setView={layout.setView} shortcutOverrides={shortcutOverrides} />
        <WorkspaceViewRouter view={layout.view} article={article} workspace={workspace} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} />
        <ArticleStatusBar revisionNumber={revisionNumber} characterCount={publishing.count} profile={publishing.profile} setProfile={publishing.setProfile} />
    </div>;
}
