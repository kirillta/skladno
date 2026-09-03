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


type TranslationResult = EditorialResult<{ metadata: TranslationMetadata; content: string }>;


function isProposalOperation(operation: EditorialOperation): boolean {
    return operation === "thesis_to_narrative" || operation === "flow_revision" || operation === "style_review";
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
    const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
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
    const translations = translationResults.filter((result) => result.articleId === selectedArticleId);
    const factCheckStale = factCheck?.findings.some((finding) => finding.stale) ?? false;
    const styleReviewStale = styleReviewResult?.articleId === selectedArticleId && styleReviewResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;
    const translationStale = translations.some((result) => result.baseRevisionId !== workspace.selectedArticle?.currentRevisionId);


    function retainTranslation(result: TranslationResult) {
        setTranslationResults((current) => [...current.filter((item) => item.articleId !== result.articleId || item.value.metadata.targetLanguage !== result.value.metadata.targetLanguage), result]);
    }


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


    function handleEditorialEvent(event: EditorialEvent, articleId: string, content: string, revisionId: string, operation: EditorialOperation, correctedFindingIds?: string[]) {
        if (event.type === "text_delta" && isProposalOperation(operation))
            setProposal((value) => value + event.delta);

        if (event.type === "completed") {
            if (isProposalOperation(operation))
                setProposal(event.text);

            if (isProposalOperation(operation) && event.editorialArtifactId)
                setBase({ articleId, content, revisionId, editorialArtifactId: event.editorialArtifactId, ...(correctedFindingIds?.length ? { correctedFindingIds } : {}) });

            if (event.factCheck) {
                setFactCheckResult({ articleId, baseRevisionId: revisionId, value: event.factCheck });
                void loadFactChecks();
            }

            if (event.styleReview)
                setStyleReviewResult({ articleId, baseRevisionId: revisionId, value: event.styleReview });

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


    async function createTranslation(targetLanguage: string) {
        const article = workspace.selectedArticle;
        const translationResult = translations.find((result) => result.value.metadata.targetLanguage === targetLanguage);
        if (!article || !translationResult || translationResult.baseRevisionId !== article.currentRevisionId)
            return;

        const translation = translationResult.value.metadata;

        try {
            const { defaultProfileId: configuredDefaultProfile } = await client.getPublishingSettings();
            await workspace.create({
                title: translation.title ?? article.title,
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
            throw error;
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

        if (result.factCheck)
            setFactCheckResult({ articleId, baseRevisionId, value: result.factCheck });

        if (result.styleReview)
            setStyleReviewResult({ articleId, baseRevisionId, value: result.styleReview });

        if (result.translation)
            retainTranslation({ articleId, baseRevisionId, value: result.translation });
    }, [workspace.articles, workspace.content]);

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
        translation: translations.at(-1)?.value.metadata,
        translations: translations.map((result) => ({ ...result.value, baseRevisionId: result.baseRevisionId })),
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
