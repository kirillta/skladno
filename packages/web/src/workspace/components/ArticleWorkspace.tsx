import { Banner, Button, EmptyState } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { ArticleRevisionsState, ArticleWorkspaceState, EditorialProposalState, PublishingState, StyleCorpusState, WorkspaceLayoutState } from "../EditorialWorkspace.js";
import { ArticleHeader } from "./ArticleHeader.js";
import { ArticleStatusBar } from "./ArticleStatusBar.js";
import { WorkspaceTabBar } from "./WorkspaceTabBar.js";
import { WorkspaceViewRouter } from "./WorkspaceViewRouter.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";

export function ArticleWorkspace({ workspace, layout, editorial, revisions, corpus, publishing, createBlank }: {
    workspace: ArticleWorkspaceState;
    layout: WorkspaceLayoutState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    createBlank: () => Promise<unknown>
}) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const article = workspace.selectedArticle;

    if (!article)
        return <EmptyState title={intl.formatMessage({ id: "navigation.noArticlesYet" })} className="pt-40">
            <Button onClick={() => void createBlank()}>{intl.formatMessage({ id: "articleWorkspace.create" })}</Button>
        </EmptyState>;

    const revisionIndex = revisions.revisions.findIndex((revision) => revision.id === article.currentRevisionId);
    const revisionNumber = revisionIndex < 0 ? 1 : revisionIndex + 1;

    return <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <ArticleHeader article={article}
            updateArticle={workspace.updateArticle}
            save={workspace.save}
            remove={workspace.remove}
            focusMode={layout.focusMode}
            setFocusMode={layout.setFocusMode}
            language={layout.targetLanguage}
            setLanguage={layout.setTargetLanguage}
            notifyError={notifyError}
        />
        {workspace.conflict && <Banner className="m-3" tone="error" role="alert">
            <span>{intl.formatMessage({ id: "draftConflict.banner" })}</span>
            <Button className="ml-auto" variant="secondary" onClick={workspace.openComparison}>{intl.formatMessage({ id: "draftConflict.compare" })}</Button>
        </Banner>}
        {workspace.saveState === "error" && <Banner className="m-3" tone="warning" role="alert">
            <span>{intl.formatMessage({ id: "draftSave.failure" })}</span>
            <Button className="ml-auto" variant="secondary" onClick={() => void workspace.retry()}>{intl.formatMessage({ id: "draftSave.retry" })}</Button>
        </Banner>}
        <WorkspaceTabBar view={layout.view} setView={layout.setView} />
        <WorkspaceViewRouter view={layout.view} article={article} workspace={workspace} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} />
        <ArticleStatusBar revisionNumber={revisionNumber} characterCount={publishing.count} profile={publishing.profile} setProfile={publishing.setProfile} />
    </div>;
}
