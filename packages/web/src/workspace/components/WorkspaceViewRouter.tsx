import type { ReactNode } from "react";
import type { Article, GeneralSettings } from "@skladno/shared";
import type { ArticleRevisionsState } from "../state/article-revisions-state.js";
import type { ArticleWorkspaceState } from "../state/article-workspace-state.js";
import type { EditorialProposalState } from "../state/editorial-proposal-state.js";
import type { PublishingState } from "../state/publishing-state.js";
import type { StyleCorpusState } from "../state/style-corpus-state.js";
import { ArticleEditorView } from "../views/ArticleEditorView.js";
import { FactCheckView } from "../views/FactCheckView.js";
import { ProposalReviewView } from "../views/ProposalReviewView.js";
import { PublishingPreviewView } from "../views/PublishingPreviewView.js";
import type { WorkspaceView } from "../workspace-views.js";
import { RevisionHistoryView } from "../views/RevisionHistoryView.js";
import { StyleProfileView } from "../views/StyleProfileView.js";
import { TranslationsView } from "../views/TranslationsView.js";


export function WorkspaceViewRouter({ view, article, workspace, editorial, revisions, corpus, publishing, generalSettings, runFactCheck, runTranslation, onSelectionChange, assistantSelection, proposalWarningsDismissed, dismissProposalWarnings, openWrite, openAssistant }: {
    view: WorkspaceView;
    article: Article;
    workspace: ArticleWorkspaceState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    generalSettings: GeneralSettings;
    runFactCheck: () => void;
    runTranslation: () => void;
    onSelectionChange?: (value: string | undefined) => void;
    assistantSelection?: string;
    proposalWarningsDismissed: boolean;
    dismissProposalWarnings: () => void;
    openWrite: () => void;
    openAssistant: () => void;
}) {
    const panel = (children: ReactNode) => <section role="tabpanel" id={`workspace-panel-${view}`} aria-labelledby={`workspace-tab-${view}`} className={view === "write" || view === "revisions" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : view === "style-profile" ? "min-h-0 flex-1 overflow-hidden p-5" : "min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong"}>{children}</section>;

    if (view === "write")
        return panel(<ArticleEditorView articleId={article.id} content={workspace.content} setContent={workspace.setContent} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} />);

    if (view === "proposal")
        return panel(<ProposalReviewView review={editorial.review} stale={editorial.stale} decisions={editorial.decisions} summaries={editorial.proposalSummaries} summaryState={editorial.proposalSummaryState} setDecision={editorial.setDecision} acceptAll={editorial.acceptAll} applyAccepted={editorial.applyAccepted} rejectAll={editorial.rejectAll} dismissProposal={editorial.dismissProposal} warningsDismissed={proposalWarningsDismissed} dismissWarnings={dismissProposalWarnings} openWrite={openWrite} openAssistant={openAssistant} />);

    if (view === "revisions")
        return panel(<RevisionHistoryView revisions={revisions.revisions} currentRevisionId={article.currentRevisionId} select={revisions.setCandidate} generalSettings={generalSettings} />);

    if (view === "fact-check") {
        const revisionNumber = revisions.revisions.findIndex((revision) => revision.id === editorial.factCheck?.reviewedRevisionId);
        const reusedRevisionNumbers = Object.fromEntries(revisions.revisions.map((revision, index) => [revision.id, index + 1]));
        return panel(<FactCheckView factCheck={editorial.factCheck} revisionNumber={revisionNumber < 0 ? undefined : revisionNumber + 1} reusedRevisionNumbers={reusedRevisionNumbers} stale={editorial.factCheckStale} runAgain={runFactCheck} resolve={editorial.resolveFactCheck} proposeCorrections={editorial.proposeFactCorrections} />);
    }

    if (view === "style-profile")
        return panel(<StyleProfileView corpus={corpus.corpus} findings={editorial.styleReview} findingsStale={editorial.styleReviewStale} articleId={article.id} revisions={revisions.revisions} generalSettings={generalSettings} add={corpus.add} remove={corpus.remove} setIncluded={corpus.setIncluded} setRules={corpus.setRules} rebuild={corpus.rebuild} getArticleRules={corpus.getArticleRules} setArticleRules={corpus.setArticleRules} snapshotArticleRevision={corpus.snapshotArticleRevision} />);

    if (view === "translations")
        return panel(<TranslationsView article={article} sourceArticle={article.sourceArticleId ? workspace.articles.find((item) => item.id === article.sourceArticleId) : undefined} translations={editorial.translations} sourceRevisionId={article.sourceRevisionId} stale={editorial.translationStale || Boolean(article.sourceArticleId && workspace.articles.find((item) => item.id === article.sourceArticleId)?.currentRevisionId !== article.sourceRevisionId)} create={editorial.createTranslation} translate={runTranslation} translationLanguages={generalSettings.defaultTranslationLanguages.filter((language) => language !== article.language)} />);

    return panel(<PublishingPreviewView publishing={publishing} />);
}
