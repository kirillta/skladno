import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { IntlShape } from "react-intl";
import {
    applyProposalChanges,
    ArticleRevisionConflictError,
    createTextProposal,
    REVISION_PROVENANCE_KIND,
    type AssistantEditorialResult,
    type AssistantMessage,
    type Article,
    type EditorialOperation,
    type FactCheck,
    type TextProposal,
} from "@skladno/shared";
import { ApplicationClientError } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application/client.js";
import { getErrorMessageId } from "../../i18n/errors.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import { getDesktopTelemetryClient } from "../../application/desktop-client.js";
import { beginBestEffortTelemetryCapture, captureBestEffortTelemetry } from "../telemetry.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { getProviderLanguageName } from "./editorial-language.js";
import { handleEditorialEvent, isProposalOperation, type ProposalBase, type ProposalState } from "./editorial-proposal-helpers.js";
import type { useEditorialResults } from "./editorial-results-state.js";

type EditorialResultsState = ReturnType<typeof useEditorialResults>;

export type ProposalDecision = "pending" | "accepted" | "rejected";


interface ProposalSetters {
    setProposal: Dispatch<SetStateAction<string>>;
    setBase: Dispatch<SetStateAction<ProposalBase | undefined>>;
    setDecisions: Dispatch<SetStateAction<Record<string, ProposalDecision>>>;
    setState: Dispatch<SetStateAction<ProposalState>>;
    setMessage: Dispatch<SetStateAction<string>>;
}


type ProposalActionsInput = ProposalSetters & {
    client: EditorialWorkspaceClient;
    workspace: ArticleWorkspaceState;
    intl: IntlShape;
    proposal: {
        base: ProposalBase | undefined;
        review: TextProposal | undefined;
        accepted: boolean;
        stale: boolean;
        decisions: Record<string, ProposalDecision>;
    };
    summaries: {
        setProposalSummaries: Dispatch<SetStateAction<Record<string, string>>>;
        setProposalSummaryLocale: Dispatch<SetStateAction<string | undefined>>;
    };
    results: Pick<EditorialResultsState, "applyResult" | "loadFactChecks" | "markCorrectedFindings" | "resolveFactCheck" | "createTranslation" | "rejectTranslation" | "setFactCheck" | "setStyleReview" | "retainTranslation" | "replaceTranslations">;
    restoredArticleIds: { current: Set<string> };
    controller: { current: AbortController | undefined };
};


function restoredAcceptance(article: Article, message: AssistantMessage, review: TextProposal): Record<string, ProposalDecision> | undefined {
    if (message.proposalAcceptance?.kind === "whole")
        return Object.fromEntries(review.changes.map((change) => [change.id, "accepted"]));

    if (message.proposalAcceptance?.kind === "changes") {
        const acceptedChangeIds = new Set(message.proposalAcceptance.acceptedChangeIds);
        return Object.fromEntries(review.changes.map((change) => [change.id, acceptedChangeIds.has(change.id) ? "accepted" : "rejected"]));
    }

    const provenance = article.currentRevision.provenance;
    if (provenance.kind !== REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL || provenance.baseRevisionId !== message.baseRevisionId)
        return undefined;

    const wholeProposal = provenance.wholeProposal === true;
    const acceptedChangeIds = Array.isArray(provenance.acceptedChangeIds) && provenance.acceptedChangeIds.every((id) => typeof id === "string")
        ? new Set(provenance.acceptedChangeIds)
        : undefined;
    const artifactMatches = typeof provenance.editorialArtifactId === "string" && provenance.editorialArtifactId === message.editorialArtifactId;
    if (wholeProposal) {
        if (!artifactMatches && article.currentRevision.content !== review.proposedContent)
            return undefined;

        return Object.fromEntries(review.changes.map((change) => [change.id, "accepted"]));
    }

    if (!acceptedChangeIds)
        return undefined;

    const acceptedContent = applyProposalChanges(review, acceptedChangeIds);
    const acceptedContentWithBlankLines = applyProposalChanges(review, acceptedChangeIds, true);
    if (!artifactMatches && article.currentRevision.content !== acceptedContent && article.currentRevision.content !== acceptedContentWithBlankLines)
        return undefined;

    return Object.fromEntries(review.changes.map((change) => [change.id, acceptedChangeIds.has(change.id) ? "accepted" : "rejected"]));
}


export function useProposalActions({ client, workspace, intl, proposal: { base, review, accepted, stale, decisions }, summaries: { setProposalSummaries, setProposalSummaryLocale }, results, restoredArticleIds, controller, ...setters }: ProposalActionsInput) {
    const { notifyError } = useNotifications();
    const telemetry = getDesktopTelemetryClient();
    const { setProposal, setBase, setDecisions, setState, setMessage } = setters;
    const { applyResult, loadFactChecks, markCorrectedFindings, resolveFactCheck, createTranslation, rejectTranslation, setFactCheck, setStyleReview, retainTranslation, replaceTranslations } = results;


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

            const requestController = new AbortController();
            controller.current = requestController;
            await client.streamEditorial(article.id, { requestId: crypto.randomUUID(), operation, authorContext, ...(targetLanguage ? { targetLanguage: getProviderLanguageName(targetLanguage) } : {}) }, (event) => handleEditorialEvent({ event, articleId: article.id, content, revisionId, operation, correctedFindingIds, setProposal, setBase, setState, setMessage, setFactCheck, loadFactChecks, setStyleReview, retainTranslation, intl }), requestController.signal);
        } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) {
                setState("error");
                if (error instanceof ApplicationClientError)
                    setMessage(intl.formatMessage({ id: getErrorMessageId(error.code) }, error.parameters));
                else
                    setMessage(intl.formatMessage({ id: "errors.editorialRequestFailed" }));
            }
        }
    }


    async function accept(acceptedChangeIds: ReadonlySet<string>, wholeProposal = false) {
        const article = workspace.selectedArticle;
        if (!article || !base || !review || stale || accepted)
            return;

        const telemetryGeneration = await beginBestEffortTelemetryCapture(telemetry);
        const content = base.correctedFindingIds?.length
            ? applyProposalChanges(review, wholeProposal ? new Set(review.changes.map((change) => change.id)) : acceptedChangeIds, true)
            : wholeProposal ? review.proposedContent : applyProposalChanges(review, acceptedChangeIds);
        try {
            const revision = await client.acceptProposal(article.id, {
                baseRevisionId: base.revisionId,
                content,
                interfaceLocale: intl.locale,
                provenance: {
                    kind: REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL,
                    baseRevisionId: base.revisionId,
                    ...(base.editorialArtifactId ? { editorialArtifactId: base.editorialArtifactId } : {}),
                    ...(wholeProposal ? { wholeProposal: true } : { acceptedChangeIds: [...acceptedChangeIds] })
                }
            });

            workspace.updateRevision(article.id, revision);
            workspace.setContent(content);
            captureBestEffortTelemetry(telemetry, { kind: "proposal_reviewed", decision: "accepted" }, telemetryGeneration);
            if (base.correctedFindingIds?.length)
                await markCorrectedFindings(article.id, base.correctedFindingIds);

            setBase({ ...base, accepted: true });
            setDecisions(Object.fromEntries(review.changes.map((change) => [change.id, wholeProposal || acceptedChangeIds.has(change.id) ? "accepted" : "rejected"])));
        } catch (error) {
            if (error instanceof ArticleRevisionConflictError) {
                workspace.updateRevision(article.id, error.article.currentRevision);
                return;
            }

            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.acceptProposalFailed" }) });
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

        applyResult(articleId, baseRevisionId, result, editorialArtifactId);
    }, [applyResult, restoredArticleIds, setBase, setDecisions, setProposal, setProposalSummaries, setProposalSummaryLocale, workspace.articles, workspace.content]);

    const restoreAssistantProposal = useCallback((messages: AssistantMessage[] | undefined) => {
        const article = workspace.selectedArticle;
        if (!article)
            return;

        replaceTranslations(article.id, messages);
        if (restoredArticleIds.current.has(article.id))
            return;

        const message = [...(messages ?? [])].reverse().find((item) => item.responseKind !== "translation_proposal_prepared" && item.proposalContent && item.baseRevisionId && item.baseRevisionContent);
        if (!message && !(messages ?? []).some((item) => item.status === "completed" && item.translation && item.baseRevisionId))
            return;

        restoredArticleIds.current.add(article.id);
        if (message) {
            const restoredReview = createTextProposal(message.baseRevisionContent!, message.proposalContent!);
            const acceptance = restoredAcceptance(article, message, restoredReview);
            setBase({ articleId: article.id, content: message.baseRevisionContent!, revisionId: message.baseRevisionId!, ...(message.editorialArtifactId ? { editorialArtifactId: message.editorialArtifactId } : {}), ...(acceptance ? { accepted: true } : {}) });
            setProposal(message.proposalContent!);
            setProposalSummaries(Object.fromEntries((message.proposalSummaries ?? []).map((summary) => [summary.changeId, summary.summary])));
            setProposalSummaryLocale(message.proposalSummaryLocale);
            setDecisions(acceptance ?? {});
        }

    }, [replaceTranslations, restoredArticleIds, setBase, setDecisions, setProposal, setProposalSummaries, setProposalSummaryLocale, workspace.selectedArticle]);

    const setDecision = (id: string, decision: ProposalDecision) => setDecisions((current) => ({ ...current, [id]: decision }));
    const acceptAll = () => accept(new Set(review ? review.changes.map((change) => change.id) : []), true);
    const applyAccepted = () => accept(new Set(Object.entries(decisions).filter(([, decision]) => decision === "accepted").map(([id]) => id)), false);
    const rejectAll = () => {
        setDecisions(Object.fromEntries((review?.changes ?? []).map((change) => [change.id, "rejected"])));
        void beginBestEffortTelemetryCapture(telemetry).then((generation) => captureBestEffortTelemetry(telemetry, { kind: "proposal_reviewed", decision: "rejected" }, generation));
    };
    const dismissProposal = () => {
        if (base)
            restoredArticleIds.current.add(base.articleId);

        setProposal("");
        setBase(undefined);
        setDecisions({});
    };
    const proposeFactCorrections = (findings: FactCheck["findings"]) => {
        const authorContext = intl.formatMessage({ id: "assistant.factCheckCorrectionPrompt" }, { findings: findings.map((finding) => `- ${finding.claim}\n  ${finding.rationale}`).join("\n") });
        const correctedFindingIds = findings.flatMap((finding) => finding.occurrenceId ? [finding.occurrenceId] : []);
        return request("flow_revision", authorContext, undefined, correctedFindingIds);
    };

    return {
        setDecision,
        request,
        acceptAll,
        applyAccepted,
        rejectAll,
        dismissProposal,
        cancel: () => controller.current?.abort(),
        loadFactChecks,
        resolveFactCheck,
        proposeFactCorrections,
        createTranslation,
        rejectTranslation,
        applyAssistantResult,
        restoreAssistantProposal,
    };
}
