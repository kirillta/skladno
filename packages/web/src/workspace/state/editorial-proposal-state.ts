import { useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
    applyProposalChanges,
    ArticleRevisionConflictError,
    createTextProposal,
    defaultPublishLimitProfileId,
    isPublishLimitProfileId,
    REVISION_PROVENANCE_KIND,
    type AssistantEditorialResult,
    type EditorialEvent,
    type EditorialOperation,
    type FactCheck,
    type StyleReview,
    type TranslationMetadata,
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


export function useEditorialProposal(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [proposal, setProposal] = useState("");
    const [base, setBase] = useState<{ articleId: string; content: string; revisionId: string }>();
    const [decisions, setDecisions] = useState<Record<string, ProposalDecision>>({});
    const [state, setState] = useState<ProposalState>("idle");
    const [message, setMessage] = useState("");
    const [factCheckResult, setFactCheckResult] = useState<EditorialResult<FactCheck>>();
    const [styleReviewResult, setStyleReviewResult] = useState<EditorialResult<StyleReview>>();
    const [translationResult, setTranslationResult] = useState<EditorialResult<{ metadata: TranslationMetadata; content: string }>>();
    const controller = useRef<AbortController>();
    const review = useMemo(() => base && base.articleId === workspace.selectedArticle?.id ? createTextProposal(base.content, proposal) : undefined, [base, proposal, workspace.selectedArticle?.id]);
    const stale = Boolean(workspace.selectedArticle && base?.articleId === workspace.selectedArticle.id && base.revisionId !== workspace.selectedArticle.currentRevisionId);
    const selectedArticleId = workspace.selectedArticle?.id;
    const factCheck = factCheckResult?.articleId === selectedArticleId ? factCheckResult?.value : undefined;
    const styleReview = styleReviewResult?.articleId === selectedArticleId ? styleReviewResult?.value : undefined;
    const translation = translationResult?.articleId === selectedArticleId ? translationResult?.value.metadata : undefined;
    const factCheckStale = factCheckResult?.articleId === selectedArticleId && factCheckResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;
    const styleReviewStale = styleReviewResult?.articleId === selectedArticleId && styleReviewResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;
    const translationStale = translationResult?.articleId === selectedArticleId && translationResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;


    async function request(operation: EditorialOperation, authorContext: string, targetLanguage?: string) {
        const article = workspace.selectedArticle;
        if (!article)
            return;

        try {
            const saved = await workspace.save(article.id);
            const revisionId = saved?.id ?? article.currentRevisionId;
            const content = saved?.content ?? workspace.content;

            if (operation === "thesis_to_narrative" || operation === "flow_revision") {
                setBase({ articleId: article.id, content, revisionId });
                setProposal("");
                setDecisions({});
            }

            setMessage("");
            setState("streaming");

            controller.current = new AbortController();

            await client.streamEditorial(article.id, { requestId: crypto.randomUUID(), operation, authorContext, ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}) }, (event: EditorialEvent) => {
                if (event.type === "text_delta" && (operation === "thesis_to_narrative" || operation === "flow_revision"))
                    setProposal((value) => value + event.delta);

                if (event.type === "completed") {
                    if (operation === "thesis_to_narrative" || operation === "flow_revision")
                        setProposal(event.text);

                    if (event.factCheck)
                        setFactCheckResult({ articleId: article.id, baseRevisionId: revisionId, value: event.factCheck });

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


    async function accept(acceptedChangeIds: ReadonlySet<string>, wholeProposal = false) {
        const article = workspace.selectedArticle;
        if (!article || !base || !review || stale)
            return;

        const content = wholeProposal ? review.proposedContent : applyProposalChanges(review, acceptedChangeIds);
        try {
            const revision = await client.acceptProposal(article.id, { baseRevisionId: base.revisionId, content, provenance: { kind: REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL, baseRevisionId: base.revisionId, ...(wholeProposal ? { wholeProposal: true } : { acceptedChangeIds: [...acceptedChangeIds] }) } });

            workspace.updateRevision(article.id, revision);
            workspace.setContent(content);
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


    function applyAssistantResult(articleId: string, baseRevisionId: string, result: AssistantEditorialResult) {
        const article = workspace.articles.find((item) => item.id === articleId);
        if (!article)
            return;

        if (result.proposal) {
            setBase({ articleId, content: article.currentRevision.content, revisionId: baseRevisionId });
            setProposal(result.proposal);
            setDecisions({});
        }

        if (result.factCheck)
            setFactCheckResult({ articleId, baseRevisionId, value: result.factCheck });

        if (result.styleReview)
            setStyleReviewResult({ articleId, baseRevisionId, value: result.styleReview });

        if (result.translation)
            setTranslationResult({ articleId, baseRevisionId, value: result.translation });
    }

    return {
        proposal,
        review,
        base,
        stale,
        proposalStale: stale,
        decisions,
        setDecision: (id: string, decision: ProposalDecision) => setDecisions((current) => ({ ...current, [id]: decision })),
        state,
        message,
        factCheck,
        factCheckStale,
        styleReview,
        styleReviewStale,
        translation,
        translationStale,
        request,
        acceptAll: () => accept(new Set(review ? review.changes.map((change) => change.id) : []), true),
        applyAccepted: () => accept(new Set(Object.entries(decisions).filter(([, decision]) => decision === "accepted").map(([id]) => id)), false),
        reject: () => {
            setProposal("");
            setBase(undefined);
            setDecisions({});
        },
        cancel: () => controller.current?.abort(),
        createTranslation,
        applyAssistantResult
    };
}


export type EditorialProposalState = ReturnType<typeof useEditorialProposal>;
