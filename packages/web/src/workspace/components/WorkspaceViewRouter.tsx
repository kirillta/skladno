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

export function WorkspaceViewRouter({ view, article, workspace, editorial, revisions, corpus, publishing, generalSettings, onSelectionChange, assistantSelection }: {
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
}) {
    const panel = (children: ReactNode) => <section role="tabpanel" id={`workspace-panel-${view}`} aria-labelledby={`workspace-tab-${view}`} className={view === "write" || view === "revisions" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto p-5"}>{children}</section>;

    if (view === "write")
        return panel(<ArticleEditorView articleId={article.id} content={workspace.content} setContent={workspace.setContent} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} />);

    if (view === "proposal")
        return panel(<ProposalReviewView review={editorial.review} stale={editorial.stale} selectedChanges={editorial.selectedChanges} setSelectedChanges={editorial.setSelectedChanges} accept={editorial.accept} reject={editorial.reject} />);

    if (view === "revisions")
        return panel(<RevisionHistoryView revisions={revisions.revisions} currentRevisionId={article.currentRevisionId} select={revisions.setCandidate} generalSettings={generalSettings} />);

    if (view === "fact-check")
        return panel(<FactCheckView factCheck={editorial.factCheck} />);

    if (view === "style-profile")
        return panel(<StyleProfileView corpus={corpus.corpus} findings={editorial.styleReview} add={corpus.add} remove={corpus.remove} />);

    if (view === "translations")
        return panel(<TranslationsView article={article} translation={editorial.translation} stale={editorial.translationStale} create={editorial.createTranslation} />);

    return panel(<PublishingPreviewView publishing={publishing} />);
}
