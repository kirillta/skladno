import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
    applyProposalChanges,
    ArticleRevisionConflictError,
    createTextProposal,
    defaultPublishLimitProfileId,
    isPublishLimitProfileId,
    REVISION_PROVENANCE_KIND,
    type AssistantEditorialResult,
    type AssistantMessage,
    type EditorialEvent,
    type EditorialOperation,
    type FactCheck,
    type StyleReview,
    type TranslationMetadata,
    type ProposalChangeSummary,
} from "@skladno/shared";
import { ApplicationClientError } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { errorMessageId } from "../../i18n/errors.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { providerLanguageName, targetLanguageId } from "./editorial-language.js";

type ProposalState = "idle" | "streaming" | "error";
type ProposalDecision = "pending" | "accepted" | "rejected";


interface EditorialResult<T> {
    articleId: string;
    baseRevisionId: string;
    value: T;
}


export function withFindingFreshness(factCheck: FactCheck, revisionId: string, content: string): FactCheck {
    const normalizedContent = content.replace(/\s+/g, " ").toLowerCase();
    return { ...factCheck, findings: factCheck.findings.map((finding) => ({
        ...finding,
        stale: factCheck.reviewedRevisionId !== revisionId && !finding.resolution && !normalizedContent.includes(finding.claim.replace(/\s+/g, " ").toLowerCase()),
    })) };
}


export function useEditorialProposal(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [proposal, setProposal] = useState("");
    const [base, setBase] = useState<{ articleId: string; content: string; revisionId: string; editorialArtifactId?: string; correctedFindingIds?: string[] }>();
    const [decisions, setDecisions] = useState<Record<string, ProposalDecision>>({});
    const [state, setState] = useState<ProposalState>("idle");
    const [message, setMessage] = useState("");
    const [factCheckResult, setFactCheckResult] = useState<EditorialResult<FactCheck>>();
    const [styleReviewResult, setStyleReviewResult] = useState<EditorialResult<StyleReview>>();
    const [translationResult, setTranslationResult] = useState<EditorialResult<{ metadata: TranslationMetadata; content: string }>>();
    const [proposalSummaries, setProposalSummaries] = useState<Record<string, string>>({});
    const [proposalSummaryState, setProposalSummaryState] = useState<"idle" | "loading" | "unavailable">("idle");
    const [proposalSummaryLocale, setProposalSummaryLocale] = useState<string>();
    const controller = useRef<AbortController>();
    const restoredArticleIds = useRef(new Set<string>());
    const review = useMemo(() => base && base.articleId === workspace.selectedArticle?.id ? createTextProposal(base.content, proposal) : undefined, [base, proposal, workspace.selectedArticle?.id]);
    const stale = Boolean(workspace.selectedArticle && base?.articleId === workspace.selectedArticle.id && base.revisionId !== workspace.selectedArticle.currentRevisionId);
    const selectedArticleId = workspace.selectedArticle?.id;
    const selectedFactCheck = factCheckResult && factCheckResult.articleId === selectedArticleId ? factCheckResult.value : undefined;
    const factCheck = selectedFactCheck && workspace.selectedArticle
        ? withFindingFreshness(selectedFactCheck, workspace.selectedArticle.currentRevisionId, workspace.selectedArticle.currentRevision.content)
        : undefined;
    const styleReview = styleReviewResult?.articleId === selectedArticleId ? styleReviewResult?.value : undefined;
    const translation = translationResult?.articleId === selectedArticleId ? translationResult?.value.metadata : undefined;
    const factCheckStale = factCheck?.findings.some((finding) => finding.stale) ?? false;
    const styleReviewStale = styleReviewResult?.articleId === selectedArticleId && styleReviewResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;
    const translationStale = translationResult?.articleId === selectedArticleId && translationResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;

    const loadFactChecks = useCallback(async () => {
        const article = workspace.selectedArticle;
        if (!article || !client.listFactChecks)
            return;

        const checks = await client.listFactChecks(article.id);
        const factCheck = checks.find((check) => check.reviewedRevisionId === article.currentRevisionId) ?? checks[0];
        if (factCheck)
            setFactCheckResult({ articleId: article.id, baseRevisionId: factCheck.reviewedRevisionId ?? article.currentRevisionId, value: factCheck });
    }, [client, workspace.selectedArticle]);

    useEffect(() => {
        void loadFactChecks();
    }, [loadFactChecks]);


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


    async function request(operation: EditorialOperation, authorContext: string, targetLanguage?: string, correctedFindingIds?: string[]) {
        const article = workspace.selectedArticle;
        if (!article)
            return;

        try {
            const saved = await workspace.save(article.id);
            const revisionId = saved?.id ?? article.currentRevisionId;
            const content = saved?.content ?? workspace.content;

            if (operation === "thesis_to_narrative" || operation === "flow_revision" || operation === "style_review") {
                setBase({ articleId: article.id, content, revisionId, ...(correctedFindingIds?.length ? { correctedFindingIds } : {}) });
                setProposal("");
                setDecisions({});
                setProposalSummaries({});
                setProposalSummaryLocale(undefined);
            }

            setMessage("");
            setState("streaming");

            controller.current = new AbortController();

            await client.streamEditorial(article.id, { requestId: crypto.randomUUID(), operation, authorContext, ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}) }, (event: EditorialEvent) => {
                if (event.type === "text_delta" && (operation === "thesis_to_narrative" || operation === "flow_revision" || operation === "style_review"))
                    setProposal((value) => value + event.delta);

                if (event.type === "completed") {
                    if (operation === "thesis_to_narrative" || operation === "flow_revision" || operation === "style_review")
                        setProposal(event.text);

                    if ((operation === "thesis_to_narrative" || operation === "flow_revision" || operation === "style_review") && event.editorialArtifactId)
                        setBase({ articleId: article.id, content, revisionId, editorialArtifactId: event.editorialArtifactId, ...(correctedFindingIds?.length ? { correctedFindingIds } : {}) });

                    if (event.factCheck)
                        setFactCheckResult({ articleId: article.id, baseRevisionId: revisionId, value: event.factCheck });

                    if (event.factCheck)
                        void loadFactChecks();

                    if (event.styleReview)
                        setStyleReviewResult({ articleId: article.id, baseRevisionId: revisionId, value: event.styleReview });

                    if (event.translation)
                        setTranslationResult({ articleId: article.id, baseRevisionId: revisionId, value: { metadata: event.translation, content: event.text } });

                    setState("idle");
                }

                if (event.type === "error") {
                    setState("error");
                    setMessage(intl.formatMessage({ id: errorMessageId(event.errorCode) }, event.parameters));
                }
            }, controller.current.signal);
        } catch (error) {
            if ((error as DOMException).name !== "AbortError") {
                setState("error");
                if (error instanceof ApplicationClientError)
                    setMessage(intl.formatMessage({ id: errorMessageId(error.code) }, error.parameters));
                else
                    setMessage(intl.formatMessage({ id: "errors.editorialRequestFailed" }));
            }
        }
    }


    async function markCorrectedFindings(articleId: string, findingIds: string[]) {
        if (!client.resolveFactCheckFinding)
            return;

        try {
            await Promise.all(findingIds.map((findingId) => client.resolveFactCheckFinding!(articleId, findingId, "corrected_or_removed")));
            setFactCheckResult((current) => current?.articleId === articleId ? { ...current, value: { ...current.value, findings: current.value.findings.map((finding) => findingIds.includes(finding.occurrenceId ?? "") ? { ...finding, resolution: "corrected_or_removed" } : finding) } } : current);
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
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


    async function createTranslation() {
        const article = workspace.selectedArticle;
        if (!article || !translationResult || translationResult.articleId !== article.id || translationStale)
            return;

        const translation = translationResult.value.metadata;

        try {
            const configuredDefaultProfile = await client.getPublishLimitProfile();
            await workspace.create({
                title: `${article.title} \u2014 ${translation.targetLanguage}`,
                content: translationResult.value.content,
                language: targetLanguageId(translationResult.value.metadata.targetLanguage),
                publishingProfileId: isPublishLimitProfileId(article.publishingProfileId)
                    ? article.publishingProfileId
                    : isPublishLimitProfileId(configuredDefaultProfile)
                        ? configuredDefaultProfile
                        : defaultPublishLimitProfileId,
                sourceArticleId: article.id,
                sourceRevisionId: translationResult.baseRevisionId
            });
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    const applyAssistantResult = useCallback((articleId: string, baseRevisionId: string, result: AssistantEditorialResult, editorialArtifactId?: string) => {
        const article = workspace.articles.find((item) => item.id === articleId);
        if (!article)
            return;

        if (result.proposal) {
            restoredArticleIds.current.delete(articleId);
            setBase({ articleId, content: article.currentRevision.content, revisionId: baseRevisionId, ...(editorialArtifactId ? { editorialArtifactId } : {}) });
            setProposal(result.proposal);
            setProposalSummaries({});
            setProposalSummaryLocale(undefined);
            setDecisions({});
        }

        if (result.factCheck)
            setFactCheckResult({ articleId, baseRevisionId, value: result.factCheck });

        if (result.styleReview)
            setStyleReviewResult({ articleId, baseRevisionId, value: result.styleReview });

        if (result.translation)
            setTranslationResult({ articleId, baseRevisionId, value: result.translation });
    }, [workspace.articles]);

    const restoreAssistantProposal = useCallback((messages: AssistantMessage[] | undefined) => {
        const article = workspace.selectedArticle;
        if (!article || restoredArticleIds.current.has(article.id))
            return;

        const message = [...(messages ?? [])].reverse().find((item) => item.responseKind !== "translation_proposal_prepared" && item.proposalContent && item.baseRevisionId && item.baseRevisionContent);
        const translationMessage = [...(messages ?? [])].reverse().find((item) => item.translation && item.baseRevisionId);
        if (!message && !translationMessage)
            return;

        restoredArticleIds.current.add(article.id);
        if (message) {
            setBase({ articleId: article.id, content: message.baseRevisionContent!, revisionId: message.baseRevisionId!, ...(message.editorialArtifactId ? { editorialArtifactId: message.editorialArtifactId } : {}) });
            setProposal(message.proposalContent!);
            setProposalSummaries(Object.fromEntries((message.proposalSummaries ?? []).map((summary) => [summary.changeId, summary.summary])));
            setProposalSummaryLocale(message.proposalSummaryLocale);
            setDecisions({});
        }

        if (translationMessage)
            setTranslationResult({ articleId: article.id, baseRevisionId: translationMessage.baseRevisionId!, value: translationMessage.translation! });
    }, [workspace.selectedArticle]);

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
        translationContent: translationResult && translationResult.articleId === selectedArticleId ? translationResult.value.content : undefined,
        translationBaseRevisionId: translationResult && translationResult.articleId === selectedArticleId ? translationResult.baseRevisionId : undefined,
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
        resolveFactCheck: async (findingId: string, resolution: NonNullable<FactCheck["findings"][number]["resolution"]>) => {
            const article = workspace.selectedArticle;
            if (!article || !client.resolveFactCheckFinding)
                return;

            await client.resolveFactCheckFinding(article.id, findingId, resolution);
            await loadFactChecks();
        },
        proposeFactCorrections: (findings: FactCheck["findings"]) => request("flow_revision", intl.formatMessage({ id: "assistant.factCheckCorrectionPrompt" }, { findings: findings.map((finding) => `- ${finding.claim}\n  ${finding.rationale}`).join("\n") }), undefined, findings.flatMap((finding) => finding.occurrenceId ? [finding.occurrenceId] : [])),
        createTranslation,
        applyAssistantResult,
        restoreAssistantProposal
    };
}


export type EditorialProposalState = ReturnType<typeof useEditorialProposal>;
