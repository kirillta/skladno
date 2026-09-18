import type { ReactNode } from "react";
import type { Article, GeneralSettings, PublishLimitProfile } from "@skladno/shared";
import type { ArticleRevisionsState } from "../state/article-revisions-state.js";
import type { ArticleWorkspaceState } from "../state/article-workspace-state.js";
import type { EditorialProposalState } from "../state/editorial-proposal-state.js";
import type { StyleCorpusState } from "../state/style-corpus-state.js";
import { ArticleEditorView } from "../views/ArticleEditorView.js";
import { FactCheckView } from "../views/FactCheckView.js";
import { ProposalReviewView } from "../views/ProposalReviewView.js";
import type { WorkspaceView } from "../workspace-views.js";
import { RevisionHistoryView } from "../views/RevisionHistoryView.js";
import { StyleProfileView } from "../views/StyleProfileView.js";
import { TranslationsView } from "../views/TranslationsView.js";
import type { AssistantSelectionSnapshot } from "../editor/ArticleEditorPlugins.js";


interface WorkspaceViewContent {
    view: WorkspaceView;
    article: Article;
    workspace: ArticleWorkspaceState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    generalSettings: GeneralSettings;
    publishProfile: PublishLimitProfile;
    publishProfileLabel: string;
}


interface WorkspaceViewActions {
    runFactCheck: () => void;
    runTranslation: () => void;
    onSelectionChange?: (value: AssistantSelectionSnapshot | undefined) => void;
    assistantSelection?: string;
}


interface WorkspaceViewNavigation {
    proposalWarningsDismissed: boolean;
    dismissProposalWarnings: () => void;
    openWrite: () => void;
    openAssistant: () => void;
}


export function WorkspaceViewRouter({ content, actions, navigation }: { content: WorkspaceViewContent; actions: WorkspaceViewActions; navigation: WorkspaceViewNavigation }) {
    const { view, article, workspace, editorial, revisions, corpus, generalSettings, publishProfile, publishProfileLabel } = content;
    const { runFactCheck, runTranslation, onSelectionChange, assistantSelection } = actions;
    const { proposalWarningsDismissed, dismissProposalWarnings, openWrite, openAssistant } = navigation;
    const renderPanel = (children: ReactNode) => <section data-focus-area={view === "write" ? undefined : "article-editor"} role="tabpanel" id={`workspace-panel-${view}`} aria-labelledby={`workspace-tab-${view}`} className={view === "write" || view === "revisions" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : view === "translations" ? "flex min-h-0 flex-1 flex-col overflow-hidden p-5" : view === "style-profile" ? "min-h-0 flex-1 overflow-hidden p-5" : "min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong"}>{children}</section>;

    if (view === "write")
        return renderPanel(<ArticleEditorView articleId={article.id} content={workspace.content} setContent={workspace.setContent} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} />);

    if (view === "proposal")
        return renderPanel(<ProposalReviewView data={{ review: editorial.review, accepted: editorial.accepted, stale: editorial.stale, decisions: editorial.decisions, summaries: editorial.proposalSummaries, summaryState: editorial.proposalSummaryState, warningsDismissed: proposalWarningsDismissed }} actions={{ setDecision: editorial.setDecision, acceptAll: editorial.acceptAll, applyAccepted: editorial.applyAccepted, rejectAll: editorial.rejectAll, dismissProposal: editorial.dismissProposal, dismissWarnings: dismissProposalWarnings, openWrite, openAssistant }} />);

    if (view === "revisions")
        return renderPanel(<RevisionHistoryView revisions={revisions.revisions} currentRevisionId={article.currentRevisionId} select={revisions.setCandidate} generalSettings={generalSettings} />);

    if (view === "fact-check") {
        const revisionNumber = revisions.revisions.findIndex((revision) => revision.id === editorial.factCheck?.reviewedRevisionId);
        const reusedRevisionNumbers = Object.fromEntries(revisions.revisions.map((revision, index) => [revision.id, index + 1]));
        return renderPanel(<FactCheckView data={{ factCheck: editorial.factCheck, revisionNumber: revisionNumber < 0 ? undefined : revisionNumber + 1, reusedRevisionNumbers, stale: editorial.factCheckStale }} actions={{ runAgain: runFactCheck, resolve: editorial.resolveFactCheck, proposeCorrections: editorial.proposeFactCorrections }} />);
    }

    if (view === "style-profile")
        return renderPanel(<StyleProfileView data={{ corpus: corpus.corpus, findings: editorial.styleReview, findingsStale: editorial.styleReviewStale, articleId: article.id, revisions: revisions.revisions, generalSettings }} actions={{ add: corpus.add, remove: corpus.remove, setIncluded: corpus.setIncluded, setRules: corpus.setRules, rebuild: corpus.rebuild, getArticleRules: corpus.getArticleRules, setArticleRules: corpus.setArticleRules, snapshotArticleRevision: corpus.snapshotArticleRevision }} />);

    if (view === "translations")
        return renderPanel(<TranslationsView data={{ article, sourceArticle: article.sourceArticleId ? workspace.articles.find((item) => item.id === article.sourceArticleId) : undefined, linkedTranslations: workspace.articles.filter((item) => item.sourceArticleId === article.id), translations: editorial.translations, stale: editorial.translationStale || Boolean(article.sourceArticleId && workspace.articles.find((item) => item.id === article.sourceArticleId)?.currentRevisionId !== article.sourceRevisionId), translationLanguages: generalSettings.defaultTranslationLanguages.filter((language) => language !== article.language), publishProfile, publishProfileLabel }} actions={{ create: editorial.createTranslation, edit: openWrite, openArticle: workspace.selectArticle, translate: runTranslation }} />);

    return null;
}
