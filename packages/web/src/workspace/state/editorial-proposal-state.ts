import { useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { createTextProposal } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application/client.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { useProposalActions, type ProposalDecision } from "./editorial-proposal-actions.js";
import { useProposalSummaries, type ProposalBase, type ProposalState } from "./editorial-proposal-helpers.js";
import { useEditorialResults } from "./editorial-results-state.js";

export { withFindingFreshness } from "./editorial-results-state.js";


export function useEditorialProposal(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const intl = useIntl();
    const [proposal, setProposal] = useState("");
    const [base, setBase] = useState<ProposalBase>();
    const [decisions, setDecisions] = useState<Record<string, ProposalDecision>>({});
    const [state, setState] = useState<ProposalState>("idle");
    const [message, setMessage] = useState("");
    const controller = useRef<AbortController>();
    const restoredArticleIds = useRef(new Set<string>());
    const results = useEditorialResults(client, workspace);
    const review = useMemo(() => base && base.articleId === workspace.selectedArticle?.id ? createTextProposal(base.content, proposal) : undefined, [base, proposal, workspace.selectedArticle?.id]);
    const accepted = base?.accepted === true;
    const stale = Boolean(workspace.selectedArticle && base?.articleId === workspace.selectedArticle.id && base.revisionId !== workspace.selectedArticle.currentRevisionId && !accepted);
    const summaries = useProposalSummaries(client, intl, { state, stale, review, selectedArticleId: workspace.selectedArticle?.id, editorialArtifactId: base?.editorialArtifactId });
    const actions = useProposalActions({
        client,
        workspace,
        intl,
        proposal: { base, review, accepted, stale, decisions },
        summaries: { setProposalSummaries: summaries.setProposalSummaries, setProposalSummaryLocale: summaries.setProposalSummaryLocale },
        results,
        restoredArticleIds,
        controller,
        setProposal,
        setBase,
        setDecisions,
        setState,
        setMessage,
    });

    return {
        proposal,
        review,
        base,
        accepted,
        stale,
        proposalStale: stale,
        decisions,
        state,
        message,
        proposalSummaries: summaries.proposalSummaries,
        proposalSummaryState: summaries.proposalSummaryState,
        factCheck: results.factCheck,
        factCheckStale: results.factCheckStale,
        styleReview: results.styleReview,
        styleReviewStale: results.styleReviewStale,
        translation: results.translation,
        translations: results.translations,
        translationStale: results.translationStale,
        ...actions,
    };
}


export type EditorialProposalState = ReturnType<typeof useEditorialProposal>;
