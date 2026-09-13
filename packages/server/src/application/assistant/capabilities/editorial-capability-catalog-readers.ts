import { APPLICATION_ERROR, HTTP_STATUS, getPublishLimitProfile, isPublishLimitProfileId, type Article, type EditorialArtifact, type FactCheck } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import type { ArticleService } from "../../articles/article-service.js";
import type { PublishingService } from "../../publishing/publishing-service.js";
import type { StyleCorpusService } from "../../editorial/style/style-corpus-service.js";
import { EDITORIAL_CAPABILITY } from "./editorial-capability-id.js";
import type { EditorialCapabilityId } from "./editorial-capability-id.js";


export interface ArtifactStore { list(articleId: string): EditorialArtifact[]; get(artifactId: string, articleId: string): EditorialArtifact | undefined; }


export interface FactChecksStore { list(articleId: string): FactCheck[]; }


export interface EditorialCapabilityReadDependencies {
    articles: ArticleService;
    artifacts: ArtifactStore;
    publishing: PublishingService;
    styleCorpus: StyleCorpusService;
    factChecks: FactChecksStore;
}


export function readEditorialCapability(
    dependencies: EditorialCapabilityReadDependencies,
    capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">,
    article: Article,
    input: Readonly<Record<string, string>>,
): unknown {
    switch (capability) {
        case EDITORIAL_CAPABILITY.INSPECT_ARTICLE:
            return {
                id: article.id,
                title: article.title,
                language: article.language,
                audience: article.audience,
                publishingProfileId: article.publishingProfileId,
                currentRevision: { id: article.currentRevision.id, createdAt: article.currentRevision.createdAt, content: article.currentRevision.content }
            };
        case EDITORIAL_CAPABILITY.INSPECT_LINKED_ARTICLES:
            return dependencies.articles.listArticles()
                .filter((candidate) => candidate.id === article.sourceArticleId || candidate.sourceArticleId === article.id)
                .map((candidate) => ({
                    id: candidate.id,
                    title: candidate.title,
                    language: candidate.language,
                    sourceArticleId: candidate.sourceArticleId,
                    sourceRevisionId: candidate.sourceRevisionId,
                    currentRevisionId: candidate.currentRevisionId,
                    updatedAt: candidate.updatedAt
                }));
        case EDITORIAL_CAPABILITY.INSPECT_REVISIONS:
            return dependencies.articles.listRevisions(article.id).map((revision) => ({ id: revision.id, createdAt: revision.createdAt, provenance: revision.provenance, restoredFromRevisionId: revision.restoredFromRevisionId }));
        case EDITORIAL_CAPABILITY.INSPECT_DRAFT:
            return article.draft
                ? { state: article.draft.baseRevisionId === article.currentRevisionId ? "current" : "stale", baseRevisionId: article.draft.baseRevisionId, version: article.draft.version, updatedAt: article.draft.updatedAt }
                : { state: "none" };
        case EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS:
            return dependencies.artifacts.list(article.id).map(({ id, revisionId, kind, createdAt }) => ({ id, revisionId, kind, createdAt }));
        case EDITORIAL_CAPABILITY.INSPECT_PROPOSAL_SUMMARY:
            return readProposalSummary(dependencies.artifacts, article.id, input.artifactId!);
        case EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS:
            return dependencies.factChecks.list(article.id).map((check) => ({
                reviewedRevisionId: check.reviewedRevisionId,
                createdAt: check.createdAt,
                findings: check.findings.map(({ claim, status, sources, uncertainty, checkedAt, occurrenceId, resolution, stale }) => ({ claim, status, sources, uncertainty, checkedAt, occurrenceId, resolution, stale }))
            }));
        case EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE: {
            const settings = dependencies.publishing.getSettings();
            const profileId = isPublishLimitProfileId(article.publishingProfileId) ? article.publishingProfileId : settings.defaultProfileId;
            return { profile: getPublishLimitProfile(profileId, settings) };
        }
        case EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS: {
            const corpus = dependencies.styleCorpus.get();
            return {
                status: corpus.status,
                itemCount: corpus.items.length,
                rules: corpus.rules,
                currentRevisionIncluded: corpus.items.some((item) => item.revisionId === article.currentRevisionId)
            };
        }
        case EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES:
            return { rules: dependencies.styleCorpus.getArticleRules(article.id) };
        case EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS:
            return readTranslations(dependencies.artifacts, dependencies.articles, article);
    }
}


function readProposalSummary(artifacts: ArtifactStore, articleId: string, artifactId: string): unknown {
    const artifact = artifacts.get(artifactId, articleId);
    if (!artifact)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    const content: unknown = JSON.parse(artifact.content);
    return content && typeof content === "object" && !Array.isArray(content)
        ? { artifactId: artifact.id, summaries: (content as { proposalSummaries?: unknown }).proposalSummaries ?? [] }
        : { artifactId: artifact.id, summaries: [] };
}


function readTranslations(artifacts: ArtifactStore, articles: ArticleService, article: Article): unknown {
    const prepared = artifacts.list(article.id).flatMap((artifact) => {
        try {
            const content = JSON.parse(artifact.content) as { translation?: { targetLanguage?: unknown } };
            return typeof content.translation?.targetLanguage === "string"
                ? [{ artifactId: artifact.id, revisionId: artifact.revisionId, targetLanguage: content.translation.targetLanguage, fresh: artifact.revisionId === article.currentRevisionId }]
                : [];
        } catch {
            return [];
        }
    });

    return {
        prepared,
        linked: articles.listArticles()
            .filter((candidate) => candidate.sourceArticleId === article.id)
            .map((candidate) => ({
                id: candidate.id,
                title: candidate.title,
                language: candidate.language,
                sourceRevisionId: candidate.sourceRevisionId,
                fresh: candidate.sourceRevisionId === article.currentRevisionId
            }))
    };
}
