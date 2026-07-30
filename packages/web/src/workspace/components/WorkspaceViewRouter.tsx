import type { ReactNode } from "react";
import type { Article } from "@skladno/shared";
import type { ArticleRevisionsState, ArticleWorkspaceState, EditorialProposalState, PublishingState, StyleCorpusState, WorkspaceView } from "../EditorialWorkspace.js";
import { ArticleEditorView } from "../views/ArticleEditorView.js";
import { FactCheckView } from "../views/FactCheckView.js";
import { ProposalReviewView } from "../views/ProposalReviewView.js";
import { PublishingPreviewView } from "../views/PublishingPreviewView.js";
import { RevisionHistoryView } from "../views/RevisionHistoryView.js";
import { StyleProfileView } from "../views/StyleProfileView.js";
import { TranslationsView } from "../views/TranslationsView.js";

export function WorkspaceViewRouter({ view, article, workspace, editorial, revisions, corpus, publishing }: { 
    view: WorkspaceView; 
    article: Article; 
    workspace: ArticleWorkspaceState; 
    editorial: EditorialProposalState; 
    revisions: ArticleRevisionsState; 
    corpus: StyleCorpusState; 
    publishing: PublishingState 
}) {
    const panel = (children: ReactNode) => <section role="tabpanel" id={`workspace-panel-${view}`} aria-labelledby={`workspace-tab-${view}`} className={view === "write" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto p-5"}>{children}</section>;

    if (view === "write")
        return panel(<ArticleEditorView content={workspace.content} setContent={workspace.setContent} copy={publishing.copy} count={publishing.count} />);

    if (view === "proposal")
        return panel(<ProposalReviewView review={editorial.review} stale={editorial.stale} selectedChanges={editorial.selectedChanges} setSelectedChanges={editorial.setSelectedChanges} accept={editorial.accept} reject={editorial.reject} />);

    if (view === "revisions")
        return panel(<RevisionHistoryView revisions={revisions.revisions} currentRevisionId={article.currentRevisionId} select={revisions.setCandidate} message={revisions.message} />);

    if (view === "fact-check")
        return panel(<FactCheckView factCheck={editorial.factCheck} />);

    if (view === "style-profile")
        return panel(<StyleProfileView corpus={corpus.corpus} findings={editorial.styleReview} add={corpus.add} remove={corpus.remove} />);

    if (view === "translations")
        return panel(<TranslationsView article={article} translation={editorial.translation} stale={editorial.stale} create={editorial.createTranslation} />);

    return panel(<PublishingPreviewView publishing={publishing} />);
}
