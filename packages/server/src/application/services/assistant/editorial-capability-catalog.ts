import { APPLICATION_ERROR, EDITORIAL_OPERATION, HTTP_STATUS, getPublishLimitProfile, isPublishLimitProfileId, type Article, type EditorialArtifact, type EditorialOperation, type FactCheck, type StyleCorpus } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import type { ArticleService } from "../articles/article-service.js";
import type { EditorialService } from "../editorial/editorial-service.js";
import type { PublishingService } from "../publishing/publishing-service.js";
import type { EditorialEngineEvent } from "../../models/editorial/editorial-engine-event.js";
import type { StyleCorpusService } from "../editorial/style-corpus-service.js";
import { EDITORIAL_CAPABILITY, EDITORIAL_CAPABILITY_INPUT, type EditorialCapabilityContext, type EditorialCapabilityDefinition, type EditorialCapabilityDiscoveryResult, type EditorialCapabilityId, type EditorialOperationClassification, type StreamContext } from "./editorial-capability-contracts.js";
import { editorialCapabilityDefinitions as definitions, editorialOperationClassifications as classifications } from "./editorial-capability-registry.js";
import { isValidatedEditorialCapabilityCall } from "./editorial-capability-validation.js";

export { EDITORIAL_CAPABILITY, EDITORIAL_CAPABILITY_INPUT } from "./editorial-capability-contracts.js";
export { editorialCapabilityDefinitions, editorialOperationClassifications, transportEvaluations } from "./editorial-capability-registry.js";
export { activityForEditorialOperation, capabilityForEditorialOperation, isValidatedEditorialCapabilityCall, validateEditorialCapabilityCoverage } from "./editorial-capability-validation.js";
export type { EditorialCapabilityContext, EditorialCapabilityDefinition, EditorialCapabilityDiscoveryResult, EditorialCapabilityId, EditorialCapabilityInput, EditorialCapabilityResultKind, EditorialOperationClassification, EditorialOperationClassificationKind, StreamContext, TransportEvaluation, WorkspaceDestination } from "./editorial-capability-contracts.js";


interface ArtifactStore { list(articleId: string): EditorialArtifact[]; get(artifactId: string, articleId: string): EditorialArtifact | undefined; }


interface FactChecksStore { list(articleId: string): FactCheck[]; }


function currentArticle(articles: ArticleService, context: EditorialCapabilityContext): Article {
    const article = articles.getArticle(context.articleId);
    if (!article)
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    if (article.currentRevisionId !== context.baseRevisionId)
        throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

    return article;
}


function operationFor(input: StreamContext): EditorialOperation {
    switch (input.capability) {
        case EDITORIAL_CAPABILITY.GENERATE_PROPOSAL:
            if (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE || input.operation === EDITORIAL_OPERATION.FLOW_REVISION)
                return input.operation;

            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);
        case EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS:
            return EDITORIAL_OPERATION.FLOW_REVISION;
        case EDITORIAL_CAPABILITY.FACT_CHECK:
            return EDITORIAL_OPERATION.FACT_CHECK;
        case EDITORIAL_CAPABILITY.STYLE_REVIEW:
            return EDITORIAL_OPERATION.STYLE_REVIEW;
        case EDITORIAL_CAPABILITY.TRANSLATE:
            if (!input.targetLanguage?.trim())
                throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

            return EDITORIAL_OPERATION.TRANSLATION;
    }
}


function words(value: string): readonly string[] {
    return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}


function rank(query: string, entry: EditorialOperationClassification): number {
    const queryWords = new Set(words(query));
    return words([entry.id, entry.outcome, ...entry.aliases, entry.reason ?? ""].join(" ")).reduce((score, word) => score + (queryWords.has(word) ? 1 : 0), 0);
}


export class EditorialCapabilityCatalog {
    constructor(
        private readonly articles: ArticleService,
        private readonly artifacts: ArtifactStore,
        private readonly publishing: PublishingService,
        private readonly editorial: EditorialService,
        private readonly styleCorpus: StyleCorpusService,
        private readonly factChecks: FactChecksStore = { list: () => [] }
    ) { }


    definitions(): readonly EditorialCapabilityDefinition[] {
        return definitions;
    }


    discover(query: string, scope: "article" | "selection"): readonly EditorialCapabilityDiscoveryResult[] {
        return classifications.filter((entry) => {
            if (!entry.capability)
                return true;

            const definition = definitions.find((candidate) => candidate.id === entry.capability);
            return scope === "article" || definition?.selectionCompatible === true;
        }).map((entry) => ({ entry, score: rank(query, entry) })).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id)).slice(0, 10).map(({ entry }) => {
            const definition = entry.capability ? definitions.find((candidate) => candidate.id === entry.capability) : undefined;
            return {
                operationId: entry.id,
                classification: entry.kind,
                outcome: entry.outcome,
                ...(definition && definition.input !== EDITORIAL_CAPABILITY_INPUT.NONE ? { requiredInput: definition.input } : {}),
                ...(entry.capability ? { capability: entry.capability } : {}),
                ...(entry.destination ? { destination: entry.destination } : {}),
                ...(entry.reason ? { reason: entry.reason } : {})
            };
        });
    }


    read(input: { capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">; context: EditorialCapabilityContext; input?: Readonly<Record<string, string>> }): unknown;


    read(capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">, context: EditorialCapabilityContext, input?: Readonly<Record<string, string>>): unknown;


    read(capabilityOrInput: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations"> | { capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">; context: EditorialCapabilityContext; input?: Readonly<Record<string, string>> }, suppliedContext?: EditorialCapabilityContext, suppliedInput: Readonly<Record<string, string>> = {}): unknown {
        const capability = typeof capabilityOrInput === "string" ? capabilityOrInput : capabilityOrInput.capability;
        const context = typeof capabilityOrInput === "string" ? suppliedContext : capabilityOrInput.context;
        const input = typeof capabilityOrInput === "string" ? suppliedInput : capabilityOrInput.input ?? {};

        if (!context || !isValidatedEditorialCapabilityCall(capability, input))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        return this.readCapability(capability, currentArticle(this.articles, context), input);
    }


    private readCapability(capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">, article: Article, input: Readonly<Record<string, string>>): unknown {
        switch (capability) {
            case EDITORIAL_CAPABILITY.INSPECT_ARTICLE:
                return this.readArticle(article);
            case EDITORIAL_CAPABILITY.INSPECT_LINKED_ARTICLES:
                return this.readLinkedArticles(article);
            case EDITORIAL_CAPABILITY.INSPECT_REVISIONS:
                return this.articles.listRevisions(article.id).map((revision) => ({ id: revision.id, createdAt: revision.createdAt, provenance: revision.provenance, restoredFromRevisionId: revision.restoredFromRevisionId }));
            case EDITORIAL_CAPABILITY.INSPECT_DRAFT:
                return article.draft ? { state: article.draft.baseRevisionId === article.currentRevisionId ? "current" : "stale", baseRevisionId: article.draft.baseRevisionId, version: article.draft.version, updatedAt: article.draft.updatedAt } : { state: "none" };
            case EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS:
                return this.artifacts.list(article.id).map(({ id, revisionId, kind, createdAt }) => ({ id, revisionId, kind, createdAt }));
            case EDITORIAL_CAPABILITY.INSPECT_PROPOSAL_SUMMARY:
                return this.readProposalSummary(article.id, input.artifactId!);
            case EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS:
                return this.readFactChecks(article.id);
            case EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE:
                return this.readPublishingGuidance(article);
            case EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS:
                return this.readStyleCorpus(article);
            case EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES:
                return { rules: this.styleCorpus.getArticleRules(article.id) };
            case EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS:
                return this.readTranslations(article);
        }
    }


    private readArticle(article: Article): unknown {
        return {
            id: article.id,
            title: article.title,
            language: article.language,
            audience: article.audience,
            publishingProfileId: article.publishingProfileId,
            currentRevision: { id: article.currentRevision.id, createdAt: article.currentRevision.createdAt, content: article.currentRevision.content }
        };
    }


    private readLinkedArticles(article: Article): unknown {
        return this.articles.listArticles()
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
    }


    private readProposalSummary(articleId: string, artifactId: string): unknown {
        const artifact = this.artifacts.get(artifactId, articleId);
        if (!artifact)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const content: unknown = JSON.parse(artifact.content);
        return content && typeof content === "object" && !Array.isArray(content)
            ? { artifactId: artifact.id, summaries: (content as { proposalSummaries?: unknown }).proposalSummaries ?? [] }
            : { artifactId: artifact.id, summaries: [] };
    }


    private readFactChecks(articleId: string): unknown {
        return this.factChecks.list(articleId).map((check) => ({
            reviewedRevisionId: check.reviewedRevisionId,
            createdAt: check.createdAt,
            findings: check.findings
                .map(({ claim, status, sources, uncertainty, checkedAt, occurrenceId, resolution, stale }) => ({ claim, status, sources, uncertainty, checkedAt, occurrenceId, resolution, stale }))
        }));
    }


    private readPublishingGuidance(article: Article): unknown {
        const settings = this.publishing.getSettings();
        const profileId = isPublishLimitProfileId(article.publishingProfileId) ? article.publishingProfileId : settings.defaultProfileId;
        return { profile: getPublishLimitProfile(profileId, settings) };
    }


    private readStyleCorpus(article: Article): unknown {
        const corpus = this.styleCorpus.get();
        return {
            status: corpus.status,
            itemCount: corpus.items.length,
            rules: corpus.rules,
            currentRevisionIncluded: corpus.items.some((item) => item.revisionId === article.currentRevisionId)
        };
    }


    private readTranslations(article: Article): unknown {
        const prepared = this.artifacts.list(article.id).flatMap((artifact) => {
            try {
                const content = JSON.parse(artifact.content) as { translation?: { targetLanguage?: unknown } };
                return typeof content.translation?.targetLanguage === "string"
                    ? [{
                        artifactId: artifact.id,
                        revisionId: artifact.revisionId,
                        targetLanguage: content.translation.targetLanguage,
                        fresh: artifact.revisionId === article.currentRevisionId
                    }]
                    : [];
            } catch {
                return [];
            }
        });

        return {
            prepared,
            linked: this.articles.listArticles()
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


    action(capability: Extract<EditorialCapabilityId, "add_revision_to_style_corpus" | "rebuild_style_profile">, context: EditorialCapabilityContext): StyleCorpus;


    action(capability: Extract<EditorialCapabilityId, "rename_article" | "change_article_language" | "assign_publishing_profile" | "set_article_style_rules" | "add_revision_to_style_corpus" | "rebuild_style_profile">, context: EditorialCapabilityContext, input: Readonly<Record<string, string>>): Article | { rules: string } | StyleCorpus;


    action(capability: Extract<EditorialCapabilityId, "rename_article" | "change_article_language" | "assign_publishing_profile" | "set_article_style_rules" | "add_revision_to_style_corpus" | "rebuild_style_profile">, context: EditorialCapabilityContext, input: Readonly<Record<string, string>> = {}): Article | { rules: string } | StyleCorpus {
        if (!context.authorizedActions?.includes(capability) || !isValidatedEditorialCapabilityCall(capability, input))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const article = currentArticle(this.articles, context);
        switch (capability) {
            case EDITORIAL_CAPABILITY.RENAME_ARTICLE:
                return this.articles.updateArticle(article.id, { title: input.title!.trim() });
            case EDITORIAL_CAPABILITY.CHANGE_ARTICLE_LANGUAGE:
                return this.articles.updateArticle(article.id, { language: input.language! });
            case EDITORIAL_CAPABILITY.ASSIGN_PUBLISHING_PROFILE: {
                const settings = this.publishing.getSettings();
                if (input.profileId!.startsWith("custom-") && !settings.customProfiles.some((profile) => profile.id === input.profileId))
                    throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

                return this.articles.updateArticle(article.id, { publishingProfileId: input.profileId! });
            }
            case EDITORIAL_CAPABILITY.SET_ARTICLE_STYLE_RULES:
                return { rules: this.styleCorpus.setArticleRules(article.id, input.rules ?? "") };
            case EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS:
                return this.styleCorpus.addArticleRevision(article.id, article.currentRevisionId);
            case EDITORIAL_CAPABILITY.REBUILD_STYLE_PROFILE:
                return this.styleCorpus.rebuild();
        }
    }


    stream(input: StreamContext, signal: AbortSignal, staged = false): AsyncIterable<EditorialEngineEvent> {
        let toolInput: Readonly<Record<string, string>> = {};
        if (input.capability === EDITORIAL_CAPABILITY.GENERATE_PROPOSAL)
            toolInput = { operation: input.operation ?? "" };
        else if (input.capability === EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS)
            toolInput = { findingIds: input.findingIds ?? "" };
        else if (input.capability === EDITORIAL_CAPABILITY.TRANSLATE)
            toolInput = { targetLanguage: input.targetLanguage ?? "" };

        if (!isValidatedEditorialCapabilityCall(input.capability, toolInput))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        currentArticle(this.articles, input.context);
        const operation = operationFor(input);
        const corrections = input.capability === EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS
            ? this.correctionContext(input.context.articleId, input.findingIds!)
            : "";

        const request = {
            articleId: input.context.articleId,
            requestId: input.requestId,
            operation,
            authorContext: corrections || input.authorContext,
            ...(input.skillId ? { skillId: input.skillId } : {}),
            ...(input.targetArticleCharacterLimit ? { targetArticleCharacterLimit: input.targetArticleCharacterLimit } : {}),
            ...(input.targetLanguage?.trim() ? { targetLanguage: input.targetLanguage.trim() } : {}),
            ...(input.articleContent !== undefined ? { articleContent: input.articleContent } : {}),
            ...(input.articleSelection ? { articleSelection: true } : {}),
            ...(input.surroundingArticleCharacterCount !== undefined ? { surroundingArticleCharacterCount: input.surroundingArticleCharacterCount } : {})
        };

        return staged
            ? this.editorial.streamStaged(request, signal)
            : this.editorial.stream(request, signal);
    }


    private correctionContext(articleId: string, findingIds: string): string {
        const selected = new Set(findingIds.split(",").map((id) => id.trim()));
        const findings = this.factChecks.list(articleId).flatMap((check) => check.findings).filter((finding) => finding.occurrenceId && selected.has(finding.occurrenceId));
        if (findings.length !== selected.size)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        return `Prepare a correction Proposal only for these explicitly selected advisory Findings. Preserve unrelated claims, numbers, URLs, code, technical terms, and author voice. Findings:\n${findings.map((finding) => `- ${finding.claim}: ${finding.rationale} Sources: ${finding.sources.map((source) => source.url).join(", ")}`).join("\n")}`;
    }
}
