import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import {
    defaultPublishLimitProfileId,
    isPublishLimitProfileId,
    type AssistantEditorialResult,
    type AssistantMessage,
    type FactCheck,
    type StyleReview,
    type TranslationMetadata,
} from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application/client.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { getTargetLanguageId } from "./editorial-language.js";


interface EditorialResult<T> {
    articleId: string;
    baseRevisionId: string;
    value: T;
}


type TranslationResult = EditorialResult<{ metadata: TranslationMetadata; content: string; editorialArtifactId?: string }>;


export function withFindingFreshness(factCheck: FactCheck, revisionId: string, content: string): FactCheck {
    const normalizedContent = content.replace(/\s+/g, " ").toLowerCase();
    return {
        ...factCheck, findings: factCheck.findings.map((finding) => ({
            ...finding,
            stale: factCheck.reviewedRevisionId !== revisionId && !finding.resolution && !normalizedContent.includes(finding.claim.replace(/\s+/g, " ").toLowerCase()),
        }))
    };
}


function useFactCheckResults(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const [factCheckResult, setFactCheckResult] = useState<EditorialResult<FactCheck[]>>();
    const [selectedRun, setSelectedRun] = useState<{ articleId: string; revisionId: string; index: number }>();

    const loadFactChecks = useCallback(async () => {
        const article = workspace.selectedArticle;
        if (!article || !client.listFactChecks)
            return;

        const checks = await client.listFactChecks(article.id);
        setFactCheckResult({ articleId: article.id, baseRevisionId: article.currentRevisionId, value: checks });
    }, [client, workspace.selectedArticle]);

    useEffect(() => {
        void loadFactChecks();
    }, [loadFactChecks]);

    const article = workspace.selectedArticle;
    const factCheckRuns = factCheckResult && factCheckResult.articleId === article?.id ? factCheckResult.value : [];
    const selectedIndex = selectedRun && article && selectedRun.articleId === article.id && selectedRun.revisionId === article.currentRevisionId ? selectedRun.index : undefined;
    const viewedCheck = selectedIndex === undefined
        ? factCheckRuns.find((check) => check.reviewedRevisionId === article?.currentRevisionId)
        : factCheckRuns[selectedIndex];
    const factCheck = viewedCheck && article
        ? withFindingFreshness(viewedCheck, article.currentRevisionId, article.currentRevision.content)
        : undefined;
    const factCheckStale = Boolean(factCheck && factCheck.reviewedRevisionId !== workspace.selectedArticle?.currentRevisionId);
    const factCheckHistorical = selectedIndex !== undefined && selectedIndex !== factCheckRuns.findIndex((check) => check.reviewedRevisionId === article?.currentRevisionId);

    const resolveFactCheck = useCallback(async (findingId: string, resolution: NonNullable<FactCheck["findings"][number]["resolution"]>) => {
        const article = workspace.selectedArticle;
        if (!article || !client.resolveFactCheckFinding)
            return;

        await client.resolveFactCheckFinding(article.id, findingId, resolution);
        await loadFactChecks();
    }, [client, loadFactChecks, workspace.selectedArticle]);

    const setFactCheck = useCallback((result: EditorialResult<FactCheck>) => {
        setFactCheckResult((current) => ({ ...result, value: [result.value, ...(current?.articleId === result.articleId ? current.value : [])] }));
        setSelectedRun(undefined);
    }, []);
    const selectFactCheckRun = useCallback((index: number | undefined) => {
        const article = workspace.selectedArticle;
        setSelectedRun(article && index !== undefined ? { articleId: article.id, revisionId: article.currentRevisionId, index } : undefined);
    }, [workspace.selectedArticle]);

    return { factCheck, factCheckRuns, selectedFactCheckRun: selectedIndex, selectFactCheckRun, factCheckStale, factCheckHistorical, loadFactChecks, resolveFactCheck, setFactCheck };
}


function useTranslationResults(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
    const selectedArticleId = workspace.selectedArticle?.id;

    const retainTranslation = useCallback((result: TranslationResult) => {
        setTranslationResults((current) => [...current.filter((item) => item.articleId !== result.articleId || item.value.metadata.targetLanguage !== result.value.metadata.targetLanguage), result]);
    }, []);

    const replaceTranslations = useCallback((articleId: string, messages: readonly AssistantMessage[] | undefined) => {
        const translations = (messages ?? []).flatMap((message) => message.status === "completed" && message.translation && message.baseRevisionId
            ? [{ articleId, baseRevisionId: message.baseRevisionId, value: { ...message.translation, editorialArtifactId: message.editorialArtifactId } }]
            : []);
        setTranslationResults((current) => [...current.filter((result) => result.articleId !== articleId), ...translations]);
    }, []);

    const translations = translationResults.filter((result) => result.articleId === selectedArticleId);
    const translationStale = translations.some((result) => result.baseRevisionId !== workspace.selectedArticle?.currentRevisionId);

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
                language: getTargetLanguageId(translationResult.value.metadata.targetLanguage),
                publishingProfileId: isPublishLimitProfileId(article.publishingProfileId)
                    ? article.publishingProfileId
                    : isPublishLimitProfileId(configuredDefaultProfile)
                        ? configuredDefaultProfile
                        : defaultPublishLimitProfileId,
                sourceArticleId: article.id,
                sourceRevisionId: translationResult.baseRevisionId
            });
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.createTranslationFailed" }) });
            throw error;
        }
    }, [client, intl, notifyError, translations, workspace]);

    const rejectTranslation = useCallback(async (targetLanguage: string) => {
        const article = workspace.selectedArticle;
        const translationResult = translations.find((result) => result.value.metadata.targetLanguage === targetLanguage);
        if (!article || !translationResult?.value.editorialArtifactId)
            return;

        await client.rejectTranslation(article.id, translationResult.value.editorialArtifactId);
        setTranslationResults((current) => current.filter((result) => result !== translationResult));
    }, [client, translations, workspace.selectedArticle]);

    return {
        translation: translations.at(-1)?.value.metadata,
        translations: translations.map((result) => ({ ...result.value, baseRevisionId: result.baseRevisionId })),
        translationStale, createTranslation,
        rejectTranslation,
        retainTranslation,
        replaceTranslations
    };
}


export function useEditorialResults(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState) {
    const [styleReviewResult, setStyleReviewResult] = useState<EditorialResult<StyleReview>>();
    const { setFactCheck, ...factChecks } = useFactCheckResults(client, workspace);
    const { retainTranslation, ...translationResults } = useTranslationResults(client, workspace);
    const selectedArticleId = workspace.selectedArticle?.id;
    const styleReview = styleReviewResult && styleReviewResult.articleId === selectedArticleId ? styleReviewResult.value : undefined;
    const styleReviewStale = Boolean(styleReviewResult && styleReviewResult.articleId === selectedArticleId && styleReviewResult.baseRevisionId !== workspace.selectedArticle?.currentRevisionId);

    const applyResult = useCallback((articleId: string, baseRevisionId: string, result: AssistantEditorialResult, editorialArtifactId?: string) => {
        if (result.factCheck)
            setFactCheck({ articleId, baseRevisionId, value: result.factCheck });

        if (result.styleReview)
            setStyleReviewResult({ articleId, baseRevisionId, value: result.styleReview });

        if (result.translation)
            retainTranslation({ articleId, baseRevisionId, value: { ...result.translation, editorialArtifactId } });
    }, [retainTranslation, setFactCheck]);

    return {
        ...factChecks,
        ...translationResults,
        styleReview,
        styleReviewStale,
        applyResult,
        setFactCheck: (articleId: string, baseRevisionId: string, value: FactCheck) => setFactCheck({ articleId, baseRevisionId, value }),
        setStyleReview: (articleId: string, baseRevisionId: string, value: StyleReview) => setStyleReviewResult({ articleId, baseRevisionId, value }),
        retainTranslation,
    };
}
