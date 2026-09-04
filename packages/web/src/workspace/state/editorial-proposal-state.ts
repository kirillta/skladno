import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
    applyProposalChanges,
    ArticleRevisionConflictError,
    createTextProposal,
    REVISION_PROVENANCE_KIND,
    type AssistantEditorialResult,
    type AssistantMessage,
    type EditorialEvent,
    type EditorialOperation,
    type FactCheck,
    type ProposalChangeSummary,
} from "@skladno/shared";
import { ApplicationClientError } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { errorMessageId } from "../../i18n/errors.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { providerLanguageName } from "./editorial-language.js";
import { useEditorialResults } from "./editorial-results-state.js";
export { withFindingFreshness } from "./editorial-results-state.js";

type ProposalState = "idle" | "streaming" | "error";
type ProposalDecision = "pending" | "accepted" | "rejected";


function isProposalOperation(operation: EditorialOperation): boolean {
    return operation === "thesis_to_narrative" || operation === "flow_revision" || operation === "style_review";
}


export function useEditorialProposal(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [proposal, setProposal] = useState("");
    const [base, setBase] = useState<{ articleId: string; content: string; revisionId: string; editorialArtifactId?: string; correctedFindingIds?: string[] }>();
    const [decisions, setDecisions] = useState<Record<string, ProposalDecision>>({});
    const [state, setState] = useState<ProposalState>("idle");
    const [message, setMessage] = useState("");
    const [proposalSummaries, setProposalSummaries] = useState<Record<string, string>>({});
    const [proposalSummaryState, setProposalSummaryState] = useState<"idle" | "loading" | "unavailable">("idle");
    const [proposalSummaryLocale, setProposalSummaryLocale] = useState<string>();
    const controller = useRef<AbortController>();
    const restoredArticleIds = useRef(new Set<string>());
    const {
        factCheck,
        factCheckStale,
        styleReview,
        styleReviewStale,
        translation,
        translations,
        translationStale,
        applyResult,
        loadFactChecks,
        markCorrectedFindings,
        resolveFactCheck,
        createTranslation,
        setFactCheck,
        setStyleReview,
        retainTranslation,
    } = useEditorialResults(client, workspace);
    const review = useMemo(() => base && base.articleId === workspace.selectedArticle?.id ? createTextProposal(base.content, proposal) : undefined, [base, proposal, workspace.selectedArticle?.id]);
    const stale = Boolean(workspace.selectedArticle && base?.articleId === workspace.selectedArticle.id && base.revisionId !== workspace.selectedArticle.currentRevisionId);
    const selectedArticleId = workspace.selectedArticle?.id;


    useEffect(() => {
        if (state !== "idle" || stale || !review || !selectedArticleId || !base?.editorialArtifactId || review.changes.length === 0) {
            setProposalSummaries({});
            setProposalSummaryState("idle");
            return;
        }

        if (proposalSummaryLocale === intl.locale)
            return;

        const controller = new AbortController();
        setProposalSummaryState("loading");
        void client.summarizeProposal(selectedArticleId, { editorialArtifactId: base.editorialArtifactId, interfaceLocale: intl.locale, changes: review.changes })
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
    }, [base?.editorialArtifactId, client, intl.locale, proposal, proposalSummaryLocale, review, selectedArticleId, stale, state]);


    function handleEditorialEvent(event: EditorialEvent, articleId: string, content: string, revisionId: string, operation: EditorialOperation, correctedFindingIds?: string[]) {
        if (event.type === "text_delta" && isProposalOperation(operation))
            setProposal((value) => value + event.delta);

        if (event.type === "completed") {
            if (isProposalOperation(operation))
                setProposal(event.text);

            if (isProposalOperation(operation) && event.editorialArtifactId)
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
            setMessage(intl.formatMessage({ id: errorMessageId(event.errorCode) }, event.parameters));
        }
    }


    async function request(operation: EditorialOperation, authorContext: string, targetLanguage?: string, correctedFindingIds?: string[]) {
        const article = workspace.selectedArticle;
        if (!article)
            return;

        try {
            const saved = await workspace.save(article.id);
            const revisionId = saved?.id ?? article.currentRevisionId;
            const content = saved?.content ?? workspace.content;

            if (isProposalOperation(operation)) {
                setBase({ articleId: article.id, content, revisionId, ...(correctedFindingIds?.length ? { correctedFindingIds } : {}) });
                setProposal("");
                setDecisions({});
                setProposalSummaries({});
                setProposalSummaryLocale(undefined);
            }

            setMessage("");
            setState("streaming");

            controller.current = new AbortController();

            await client.streamEditorial(article.id, { requestId: crypto.randomUUID(), operation, authorContext, ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}) }, (event) => handleEditorialEvent(event, article.id, content, revisionId, operation, correctedFindingIds), controller.current.signal);
        } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) {
                setState("error");
                if (error instanceof ApplicationClientError)
                    setMessage(intl.formatMessage({ id: errorMessageId(error.code) }, error.parameters));
                else
                    setMessage(intl.formatMessage({ id: "errors.editorialRequestFailed" }));
            }
        }
    }


    async function accept(acceptedChangeIds: ReadonlySet<string>, wholeProposal = false) {
        const article = workspace.selectedArticle;
        if (!article || !base || !review || stale)
            return;

        const content = base.correctedFindingIds?.length
            ? applyProposalChanges(review, wholeProposal ? new Set(review.changes.map((change) => change.id)) : acceptedChangeIds, true)
            : wholeProposal ? review.proposedContent : applyProposalChanges(review, acceptedChangeIds);
        try {
            const revision = await client.acceptProposal(article.id, { baseRevisionId: base.revisionId, content, provenance: { kind: REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL, baseRevisionId: base.revisionId, ...(wholeProposal ? { wholeProposal: true } : { acceptedChangeIds: [...acceptedChangeIds] }) } });

            workspace.updateRevision(article.id, revision);
            workspace.setContent(content);
            if (base.correctedFindingIds?.length)
                await markCorrectedFindings(article.id, base.correctedFindingIds);

            setProposal("");
            setBase(undefined);
            setDecisions({});
        } catch (error) {
            if (error instanceof ArticleRevisionConflictError) {
                workspace.updateRevision(article.id, error.article.currentRevision);
                return;
            }

            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    const applyAssistantResult = useCallback((articleId: string, baseRevisionId: string, result: AssistantEditorialResult, editorialArtifactId?: string) => {
        const article = workspace.articles.find((item) => item.id === articleId);
        if (!article)
            return;

        if (result.proposal) {
            restoredArticleIds.current.delete(articleId);
            setBase({ articleId, content: workspace.content, revisionId: baseRevisionId, ...(editorialArtifactId ? { editorialArtifactId } : {}) });
            setProposal(result.proposal);
            setProposalSummaries({});
            setProposalSummaryLocale(undefined);
            setDecisions({});
        }

        applyResult(articleId, baseRevisionId, result);
    }, [applyResult, workspace.articles, workspace.content]);

    const restoreAssistantProposal = useCallback((messages: AssistantMessage[] | undefined) => {
        const article = workspace.selectedArticle;
        if (!article || restoredArticleIds.current.has(article.id))
            return;

        const message = [...(messages ?? [])].reverse().find((item) => item.responseKind !== "translation_proposal_prepared" && item.proposalContent && item.baseRevisionId && item.baseRevisionContent);
        const translationMessages = (messages ?? []).filter((item) => item.translation && item.baseRevisionId);
        if (!message && !translationMessages.length)
            return;

        restoredArticleIds.current.add(article.id);
        if (message) {
            setBase({ articleId: article.id, content: message.baseRevisionContent!, revisionId: message.baseRevisionId!, ...(message.editorialArtifactId ? { editorialArtifactId: message.editorialArtifactId } : {}) });
            setProposal(message.proposalContent!);
            setProposalSummaries(Object.fromEntries((message.proposalSummaries ?? []).map((summary) => [summary.changeId, summary.summary])));
            setProposalSummaryLocale(message.proposalSummaryLocale);
            setDecisions({});
        }

        for (const translationMessage of translationMessages)
            retainTranslation({ articleId: article.id, baseRevisionId: translationMessage.baseRevisionId!, value: translationMessage.translation! });
    }, [retainTranslation, workspace.selectedArticle]);

    return {
        proposal,
        review,
        base,
        stale,
        proposalStale: stale,
        decisions,
        proposalSummaries,
        proposalSummaryState,
        setDecision: (id: string, decision: ProposalDecision) => setDecisions((current) => ({ ...current, [id]: decision })),
        state,
        message,
        factCheck,
        factCheckStale,
        styleReview,
        styleReviewStale,
        translation,
        translations,
        translationStale,
        request,
        acceptAll: () => accept(new Set(review ? review.changes.map((change) => change.id) : []), true),
        applyAccepted: () => accept(new Set(Object.entries(decisions).filter(([, decision]) => decision === "accepted").map(([id]) => id)), false),
        rejectAll: () => setDecisions(Object.fromEntries((review?.changes ?? []).map((change) => [change.id, "rejected"]))),
        dismissProposal: () => {
            if (base)
                restoredArticleIds.current.add(base.articleId);

            setProposal("");
            setBase(undefined);
            setDecisions({});
        },
        cancel: () => controller.current?.abort(),
        loadFactChecks,
        resolveFactCheck,
        proposeFactCorrections: (findings: FactCheck["findings"]) => request("flow_revision", intl.formatMessage({ id: "assistant.factCheckCorrectionPrompt" }, { findings: findings.map((finding) => `- ${finding.claim}\n  ${finding.rationale}`).join("\n") }), undefined, findings.flatMap((finding) => finding.occurrenceId ? [finding.occurrenceId] : [])),
        createTranslation,
        applyAssistantResult,
        restoreAssistantProposal
    };
}


export type EditorialProposalState = ReturnType<typeof useEditorialProposal>;
