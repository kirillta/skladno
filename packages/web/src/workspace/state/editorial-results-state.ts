import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import {
    defaultPublishLimitProfileId,
    isPublishLimitProfileId,
    type AssistantEditorialResult,
    type FactCheck,
    type StyleReview,
    type TranslationMetadata,
} from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { targetLanguageId } from "./editorial-language.js";


interface EditorialResult<T> {
    articleId: string;
    baseRevisionId: string;
    value: T;
}


type TranslationResult = EditorialResult<{ metadata: TranslationMetadata; content: string }>;


export function withFindingFreshness(factCheck: FactCheck, revisionId: string, content: string): FactCheck {
    const normalizedContent = content.replace(/\s+/g, " ").toLowerCase();
    return { ...factCheck, findings: factCheck.findings.map((finding) => ({
        ...finding,
        stale: factCheck.reviewedRevisionId !== revisionId && !finding.resolution && !normalizedContent.includes(finding.claim.replace(/\s+/g, " ").toLowerCase()),
    })) };
}


export function useEditorialResults(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [factCheckResult, setFactCheckResult] = useState<EditorialResult<FactCheck>>();
    const [styleReviewResult, setStyleReviewResult] = useState<EditorialResult<StyleReview>>();
    const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
    const selectedArticleId = workspace.selectedArticle?.id;

    const retainTranslation = useCallback((result: TranslationResult) => {
        setTranslationResults((current) => [...current.filter((item) => item.articleId !== result.articleId || item.value.metadata.targetLanguage !== result.value.metadata.targetLanguage), result]);
    }, []);

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

    const factCheck = factCheckResult && factCheckResult.articleId === selectedArticleId && workspace.selectedArticle
        ? withFindingFreshness(factCheckResult.value, workspace.selectedArticle.currentRevisionId, workspace.selectedArticle.currentRevision.content)
        : undefined;
    const styleReview = styleReviewResult?.articleId === selectedArticleId ? styleReviewResult?.value : undefined;
    const translations = translationResults.filter((result) => result.articleId === selectedArticleId);
    const factCheckStale = factCheck?.findings.some((finding) => finding.stale) ?? false;
    const styleReviewStale = styleReviewResult?.articleId === selectedArticleId && styleReviewResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;
    const translationStale = translations.some((result) => result.baseRevisionId !== workspace.selectedArticle?.currentRevisionId);

    const applyResult = useCallback((articleId: string, baseRevisionId: string, result: AssistantEditorialResult) => {
        if (result.factCheck)
            setFactCheckResult({ articleId, baseRevisionId, value: result.factCheck });

        if (result.styleReview)
            setStyleReviewResult({ articleId, baseRevisionId, value: result.styleReview });

        if (result.translation)
            retainTranslation({ articleId, baseRevisionId, value: result.translation });
    }, [retainTranslation]);

    const markCorrectedFindings = useCallback(async (articleId: string, findingIds: string[]) => {
        if (!client.resolveFactCheckFinding)
            return;

        try {
            await Promise.all(findingIds.map((findingId) => client.resolveFactCheckFinding!(articleId, findingId, "corrected_or_removed")));
            setFactCheckResult((current) => current?.articleId === articleId ? { ...current, value: { ...current.value, findings: current.value.findings.map((finding) => findingIds.includes(finding.occurrenceId ?? "") ? { ...finding, resolution: "corrected_or_removed" } : finding) } } : current);
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }, [client, intl, notifyError]);

    const resolveFactCheck = useCallback(async (findingId: string, resolution: NonNullable<FactCheck["findings"][number]["resolution"]>) => {
        const article = workspace.selectedArticle;
        if (!article || !client.resolveFactCheckFinding)
            return;

        await client.resolveFactCheckFinding(article.id, findingId, resolution);
        await loadFactChecks();
    }, [client, loadFactChecks, workspace.selectedArticle]);

    const createTranslation = useCallback(async (targetLanguage: string) => {
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
    }, [client, intl, notifyError, translations, workspace]);

    return {
        factCheck,
        factCheckStale,
        styleReview,
        styleReviewStale,
        translation: translations.at(-1)?.value.metadata,
        translations: translations.map((result) => ({ ...result.value, baseRevisionId: result.baseRevisionId })),
        translationStale,
        applyResult,
        loadFactChecks,
        markCorrectedFindings,
        resolveFactCheck,
        createTranslation,
        setFactCheck: (articleId: string, baseRevisionId: string, value: FactCheck) => setFactCheckResult({ articleId, baseRevisionId, value }),
        setStyleReview: (articleId: string, baseRevisionId: string, value: StyleReview) => setStyleReviewResult({ articleId, baseRevisionId, value }),
        retainTranslation,
    };
}
