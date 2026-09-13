import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { IntlShape } from "react-intl";
import type { EditorialEvent, EditorialOperation, FactCheck, ProposalChangeSummary, StyleReview, TextProposal, TranslationMetadata } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application/client.js";
import { getErrorMessageId } from "../../i18n/errors.js";

export type ProposalState = "idle" | "streaming" | "error";


export interface ProposalBase {
    articleId: string;
    content: string;
    revisionId: string;
    editorialArtifactId?: string;
    correctedFindingIds?: string[];
    accepted?: true;
}


export function isProposalOperation(operation: EditorialOperation) {
    return operation === "thesis_to_narrative" || operation === "flow_revision" || operation === "style_review";
}


export function useProposalSummaries(client: EditorialWorkspaceClient, intl: IntlShape, { state, stale, review, selectedArticleId, editorialArtifactId }: {
    state: ProposalState;
    stale: boolean;
    review: TextProposal | undefined;
    selectedArticleId: string | undefined;
    editorialArtifactId: string | undefined;
}) {
    const [proposalSummaries, setProposalSummaries] = useState<Record<string, string>>({});
    const [proposalSummaryState, setProposalSummaryState] = useState<"idle" | "loading" | "unavailable">("idle");
    const [proposalSummaryLocale, setProposalSummaryLocale] = useState<string>();

    useEffect(() => {
        if (state !== "idle" || stale || !review || !selectedArticleId || !editorialArtifactId || review.changes.length === 0) {
            setProposalSummaries({});
            setProposalSummaryState("idle");
            return;
        }

        if (proposalSummaryLocale === intl.locale)
            return;

        const controller = new AbortController();
        setProposalSummaryState("loading");
        void client.summarizeProposal(selectedArticleId, { editorialArtifactId, interfaceLocale: intl.locale, changes: review.changes })
            .then((summaries: ProposalChangeSummary[]) => {
                if (controller.signal.aborted)
                    return;

                setProposalSummaries(Object.fromEntries(summaries.map((summary) => [summary.changeId, summary.summary])));
                setProposalSummaryLocale(intl.locale);
                setProposalSummaryState(summaries.length > 0 ? "idle" : "unavailable");
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setProposalSummaryState("unavailable");
            });

        return () => controller.abort();
    }, [client, editorialArtifactId, intl.locale, proposalSummaryLocale, review, selectedArticleId, stale, state]);

    return { proposalSummaries, proposalSummaryState, setProposalSummaries, setProposalSummaryLocale };
}


export function handleEditorialEvent({ event, articleId, content, revisionId, operation, correctedFindingIds, setProposal, setBase, setState, setMessage, setFactCheck, loadFactChecks, setStyleReview, retainTranslation, intl }: {
    event: EditorialEvent;
    articleId: string;
    content: string;
    revisionId: string;
    operation: EditorialOperation;
    correctedFindingIds: string[] | undefined;
    setProposal: Dispatch<SetStateAction<string>>;
    setBase: Dispatch<SetStateAction<ProposalBase | undefined>>;
    setState: Dispatch<SetStateAction<ProposalState>>;
    setMessage: Dispatch<SetStateAction<string>>;
    setFactCheck: (articleId: string, baseRevisionId: string, value: FactCheck) => void;
    loadFactChecks: () => Promise<void>;
    setStyleReview: (articleId: string, baseRevisionId: string, value: StyleReview) => void;
    retainTranslation: (result: { articleId: string; baseRevisionId: string; value: { metadata: TranslationMetadata; content: string } }) => void;
    intl: IntlShape;
}) {
    if (event.type === "text_delta" && isProposalOperation(operation))
        setProposal((value) => value + event.delta);

    if (event.type === "completed") {
        if (isProposalOperation(operation))
            setProposal(event.text);

        if (isProposalOperation(operation))
            if (event.editorialArtifactId)
                setBase({ articleId, content, revisionId, editorialArtifactId: event.editorialArtifactId, ...(correctedFindingIds?.length ? { correctedFindingIds } : {}) });

        if (event.factCheck) {
            setFactCheck(articleId, revisionId, event.factCheck);
            void loadFactChecks();
        }

        if (event.styleReview)
            setStyleReview(articleId, revisionId, event.styleReview);

        if (event.translation)
            retainTranslation({ articleId, baseRevisionId: revisionId, value: { metadata: event.translation, content: event.text } });

        setState("idle");
    }

    if (event.type === "error") {
        setState("error");
        setMessage(intl.formatMessage({ id: getErrorMessageId(event.errorCode) }, event.parameters));
    }
}
