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


export function WorkspaceViewRouter({ view, article, workspace, editorial, revisions, corpus, publishing, generalSettings, onSelectionChange, assistantSelection, proposalWarningsDismissed, dismissProposalWarnings, openWrite, openAssistant }: {
    view: WorkspaceView;
    article: Article;
    workspace: ArticleWorkspaceState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    generalSettings: GeneralSettings;
    onSelectionChange?: (value: string | undefined) => void;
    assistantSelection?: string;
    proposalWarningsDismissed: boolean;
    dismissProposalWarnings: () => void;
    openWrite: () => void;
    openAssistant: () => void;
}) {
    const panel = (children: ReactNode) => <section role="tabpanel" id={`workspace-panel-${view}`} aria-labelledby={`workspace-tab-${view}`} className={view === "write" || view === "revisions" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : view === "proposal" ? "min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" : "min-h-0 flex-1 overflow-y-auto p-5"}>{children}</section>;

    if (view === "write")
        return panel(<ArticleEditorView articleId={article.id} content={workspace.content} setContent={workspace.setContent} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} />);

    if (view === "proposal")
        return panel(<ProposalReviewView review={editorial.review} stale={editorial.stale} decisions={editorial.decisions} summaries={editorial.proposalSummaries} summaryState={editorial.proposalSummaryState} setDecision={editorial.setDecision} acceptAll={editorial.acceptAll} applyAccepted={editorial.applyAccepted} rejectAll={editorial.rejectAll} dismissProposal={editorial.dismissProposal} warningsDismissed={proposalWarningsDismissed} dismissWarnings={dismissProposalWarnings} openWrite={openWrite} openAssistant={openAssistant} />);

    if (view === "revisions")
        return panel(<RevisionHistoryView revisions={revisions.revisions} currentRevisionId={article.currentRevisionId} select={revisions.setCandidate} generalSettings={generalSettings} />);

    if (view === "fact-check")
        return panel(<FactCheckView factCheck={editorial.factCheck} stale={editorial.factCheckStale} runAgain={() => editorial.request("fact_check", "")} resolve={editorial.resolveFactCheck} proposeCorrections={editorial.proposeFactCorrections} />);

    if (view === "style-profile")
        return panel(<StyleProfileView corpus={corpus.corpus} findings={editorial.styleReview} add={corpus.add} remove={corpus.remove} />);

    if (view === "translations")
        return panel(<TranslationsView article={article} translation={editorial.translation} stale={editorial.translationStale} create={editorial.createTranslation} />);

    return panel(<PublishingPreviewView publishing={publishing} />);
}
