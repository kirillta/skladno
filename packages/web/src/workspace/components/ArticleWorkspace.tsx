import { Banner, Button, EmptyState } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { ArticleRevisionsState } from "../state/article-revisions-state.js";
import type { ArticleWorkspaceState } from "../state/article-workspace-state.js";
import type { EditorialProposalState } from "../state/editorial-proposal-state.js";
import type { PublishingState } from "../state/publishing-state.js";
import type { StyleCorpusState } from "../state/style-corpus-state.js";
import type { WorkspaceLayoutState } from "../state/useWorkspaceLayout.js";
import { ArticleHeader } from "./ArticleHeader.js";
import { ArticleStatusBar } from "./ArticleStatusBar.js";
import { WorkspaceTabBar, type WorkspaceTabBadgeDescriptor } from "./WorkspaceTabBar.js";
import { WorkspaceViewRouter } from "./WorkspaceViewRouter.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import type { GeneralSettings, KeyBindingOverrides } from "@skladno/shared";
import { KEY_BINDING_COMMAND } from "@skladno/shared";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import type { WorkspaceView } from "../workspace-views.js";


export function ArticleWorkspace({ workspace, layout, editorial, revisions, corpus, publishing, generalSettings, createBlank, shortcutOverrides, onSelectionChange, assistantSelection }: {
    workspace: ArticleWorkspaceState;
    layout: WorkspaceLayoutState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    generalSettings: GeneralSettings;
    createBlank: () => Promise<unknown>;
    shortcutOverrides?: KeyBindingOverrides;
    onSelectionChange?: (value: string | undefined) => void;
    assistantSelection?: string;
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
    const badges: Partial<Record<WorkspaceView, WorkspaceTabBadgeDescriptor>> = {};

    if (editorial.review)
        badges.proposal = editorial.proposalStale
            ? { label: intl.formatMessage({ id: "workspace.badges.stale" }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.stale" }), tone: "warning" }
            : { label: intl.formatMessage({ id: "workspace.badges.review" }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.review" }), tone: "default", display: "dot" };

    if (editorial.factCheck)
        badges["fact-check"] = editorial.factCheckStale
            ? { label: intl.formatMessage({ id: "workspace.badges.stale" }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.stale" }), tone: "warning" }
            : { label: intl.formatMessage({ id: "workspace.badges.findings" }, { count: editorial.factCheck.findings.length }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.findings" }, { count: editorial.factCheck.findings.length }), tone: "default" };

    if (editorial.styleReview)
        badges["style-profile"] = editorial.styleReviewStale
            ? { label: intl.formatMessage({ id: "workspace.badges.stale" }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.stale" }), tone: "warning" }
            : { label: intl.formatMessage({ id: "workspace.badges.findings" }, { count: editorial.styleReview.findings.length }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.findings" }, { count: editorial.styleReview.findings.length }), tone: "default" };

    if (editorial.translation)
        badges.translations = editorial.translationStale
            ? { label: intl.formatMessage({ id: "workspace.badges.stale" }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.stale" }), tone: "warning" }
            : { label: intl.formatMessage({ id: "workspace.badges.ready" }), accessibleLabel: intl.formatMessage({ id: "workspace.badges.ready" }), tone: "default" };

    if (publishing.length.state !== "within-limit") {
        const messageId = publishing.length.state === "over-limit" ? "workspace.badges.overLimit" : "workspace.badges.nearLimit";
        badges.publish = { label: intl.formatMessage({ id: messageId }), accessibleLabel: intl.formatMessage({ id: messageId }), tone: "warning" };
    }

    return <div className="flex h-full min-h-0 flex-col overflow-hidden" data-article-workspace tabIndex={-1}>
        <ArticleHeader article={article}
            updateArticle={workspace.updateArticle}
            save={workspace.save}
            remove={workspace.remove}
            focusMode={layout.focusMode}
            setFocusMode={layout.setFocusMode}
            targetLanguage={layout.targetLanguage}
            setTargetLanguage={layout.setTargetLanguage}
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
        <WorkspaceTabBar view={layout.view} setView={layout.setView} badges={badges} shortcutOverrides={shortcutOverrides} />
        <WorkspaceViewRouter view={layout.view} article={article} workspace={workspace} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} generalSettings={generalSettings} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} proposalWarningsDismissed={layout.proposalWarningsDismissed} dismissProposalWarnings={() => layout.setProposalWarningsDismissed(true)} openWrite={() => layout.setView("write")} openAssistant={() => {
            layout.setAssistantCollapsed(false);
            layout.setView("write");
        }} />
        <ArticleStatusBar revisionNumber={revisionNumber} length={publishing.length} profile={publishing.profile} setProfile={publishing.setProfile} />
    </div>;
}
