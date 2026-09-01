import { APPLICATION_ERROR, EDITORIAL_OPERATION, getPublishLimitProfile, HTTP_STATUS, isPublishLimitProfileId, type Article, type AssistantAuthorizedAction, type EditorialArtifact, type EditorialOperation } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { ArticleService } from "../articles/article-service.js";
import type { EditorialService } from "../editorial/editorial-service.js";
import type { PublishingService } from "../publishing/publishing-service.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";
import type { StyleCorpusService } from "../editorial/style-corpus-service.js";


export const EDITORIAL_CAPABILITY = {
    INSPECT_ARTICLE: "inspect_article",
    INSPECT_REVISIONS: "inspect_revisions",
    INSPECT_ARTIFACTS: "inspect_artifacts",
    INSPECT_PUBLISHING_GUIDANCE: "inspect_publishing_guidance",
    GENERATE_PROPOSAL: "generate_proposal",
    FACT_CHECK: "fact_check",
    STYLE_REVIEW: "style_review",
    TRANSLATE: "translate",
    INSPECT_STYLE_CORPUS: "inspect_style_corpus",
    ADD_REVISION_TO_STYLE_CORPUS: "add_revision_to_style_corpus",
    REBUILD_STYLE_PROFILE: "rebuild_style_profile",
} as const;


export type EditorialCapabilityId = typeof EDITORIAL_CAPABILITY[keyof typeof EDITORIAL_CAPABILITY];
export type EditorialCapabilityResultKind = "article" | "revisions" | "artifacts" | "publishing-guidance" | "style-corpus" | "proposal" | "fact-check" | "style-review" | "translation";


export interface EditorialCapabilityDefinition {
    id: EditorialCapabilityId;
    allowedContext: "article";
    input: "none" | "proposal-operation" | "target-language";
    execution: "read" | "artifact" | "action";
    prerequisite?: "style-corpus" | "target-language";
    result: EditorialCapabilityResultKind;
    retry: "never" | "transient-read";
    activity: string;
}


export const editorialCapabilityDefinitions: readonly EditorialCapabilityDefinition[] = [
    { id: EDITORIAL_CAPABILITY.INSPECT_ARTICLE, execution: "read", allowedContext: "article", input: "none", result: "article", retry: "transient-read", activity: "Reviewing the current Article." },
    { id: EDITORIAL_CAPABILITY.INSPECT_REVISIONS, execution: "read", allowedContext: "article", input: "none", result: "revisions", retry: "transient-read", activity: "Reviewing Revision history." },
    { id: EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS, execution: "read", allowedContext: "article", input: "none", result: "artifacts", retry: "transient-read", activity: "Reviewing saved editorial work." },
    { id: EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE, execution: "read", allowedContext: "article", input: "none", result: "publishing-guidance", retry: "transient-read", activity: "Reviewing publishing guidance." },
    { id: EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS, execution: "read", allowedContext: "article", input: "none", result: "style-corpus", retry: "transient-read", activity: "Reviewing the Style Corpus." },
    { id: EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS, execution: "action", allowedContext: "article", input: "none", result: "style-corpus", retry: "never", activity: "Adding the current Revision to the Style Corpus." },
    { id: EDITORIAL_CAPABILITY.REBUILD_STYLE_PROFILE, execution: "action", allowedContext: "article", input: "none", prerequisite: "style-corpus", result: "style-corpus", retry: "never", activity: "Rebuilding the Style Profile." },
    { id: EDITORIAL_CAPABILITY.GENERATE_PROPOSAL, execution: "artifact", allowedContext: "article", input: "proposal-operation", result: "proposal", retry: "never", activity: "Preparing a Proposal." },
    { id: EDITORIAL_CAPABILITY.FACT_CHECK, execution: "artifact", allowedContext: "article", input: "none", result: "fact-check", retry: "never", activity: "Checking facts." },
    { id: EDITORIAL_CAPABILITY.STYLE_REVIEW, execution: "artifact", allowedContext: "article", input: "none", prerequisite: "style-corpus", result: "style-review", retry: "never", activity: "Reviewing style." },
    { id: EDITORIAL_CAPABILITY.TRANSLATE, execution: "artifact", allowedContext: "article", input: "target-language", prerequisite: "target-language", result: "translation", retry: "never", activity: "Preparing a translation." },
];


export interface EditorialCapabilityContext {
    articleId: string;
    baseRevisionId: string;
    authorizedActions?: readonly AssistantAuthorizedAction[];
}


export function isValidatedEditorialCapabilityCall(capability: string, input: Readonly<Record<string, string>>): capability is EditorialCapabilityId {
    const definition = editorialCapabilityDefinitions.find((candidate) => candidate.id === capability);
    const keys = Object.keys(input);
    if (!definition)
        return false;

    if (definition.input === "none")
        return keys.length === 0;

    if (definition.input === "proposal-operation")
        return keys.length === 1 && (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE || input.operation === EDITORIAL_OPERATION.FLOW_REVISION);

    return keys.length === 1 && Boolean(input.targetLanguage?.trim());
}


export function capabilityForEditorialOperation(operation: EditorialOperation): Extract<EditorialCapabilityId, "generate_proposal" | "fact_check" | "style_review" | "translate"> {
    return operation === EDITORIAL_OPERATION.FACT_CHECK
        ? EDITORIAL_CAPABILITY.FACT_CHECK
        : operation === EDITORIAL_OPERATION.STYLE_REVIEW
            ? EDITORIAL_CAPABILITY.STYLE_REVIEW
            : operation === EDITORIAL_OPERATION.TRANSLATION
                ? EDITORIAL_CAPABILITY.TRANSLATE
                : EDITORIAL_CAPABILITY.GENERATE_PROPOSAL;
}


export function activityForEditorialOperation(operation: EditorialOperation): string {
    const capability = capabilityForEditorialOperation(operation);

    for (const definition of editorialCapabilityDefinitions) {
        if (definition.id === capability)
            return definition.activity;
    }

    return "Preparing editorial work.";
}


export interface EditorialArtifactSummary {
    id: string;
    revisionId: string;
    kind: string;
    createdAt: string;
}


interface ArtifactStore {
    list(articleId: string): EditorialArtifact[];
}


interface ReadContext {
    capability: typeof EDITORIAL_CAPABILITY.INSPECT_ARTICLE
    | typeof EDITORIAL_CAPABILITY.INSPECT_REVISIONS
    | typeof EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS
    | typeof EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE
    | typeof EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS;
    context: EditorialCapabilityContext;
}


export interface StreamContext {
    capability: typeof EDITORIAL_CAPABILITY.GENERATE_PROPOSAL
    | typeof EDITORIAL_CAPABILITY.FACT_CHECK
    | typeof EDITORIAL_CAPABILITY.STYLE_REVIEW
    | typeof EDITORIAL_CAPABILITY.TRANSLATE;
    context: EditorialCapabilityContext;
    requestId: string;
    authorContext: string;
    operation?: Extract<EditorialOperation, "thesis_to_narrative" | "flow_revision">;
    targetLanguage?: string;
    articleContent?: string;
    articleSelection?: boolean;
    surroundingArticleCharacterCount?: number;
}


function isStreamCapability(capability: string): capability is StreamContext["capability"] {
    return capability === EDITORIAL_CAPABILITY.GENERATE_PROPOSAL
        || capability === EDITORIAL_CAPABILITY.FACT_CHECK
        || capability === EDITORIAL_CAPABILITY.STYLE_REVIEW
        || capability === EDITORIAL_CAPABILITY.TRANSLATE;
}


function currentArticle(articles: ArticleService, context: EditorialCapabilityContext): Article {
    const article = articles.getArticle(context.articleId);
    if (!article)
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    if (article.currentRevisionId !== context.baseRevisionId)
        throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

    return article;
}


function operationFor(input: StreamContext): EditorialOperation {
    if (input.capability === EDITORIAL_CAPABILITY.GENERATE_PROPOSAL) {
        if (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE || input.operation === EDITORIAL_OPERATION.FLOW_REVISION)
            return input.operation;

        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);
    }

    if (input.capability === EDITORIAL_CAPABILITY.FACT_CHECK)
        return EDITORIAL_OPERATION.FACT_CHECK;

    if (input.capability === EDITORIAL_CAPABILITY.STYLE_REVIEW)
        return EDITORIAL_OPERATION.STYLE_REVIEW;

    if (!input.targetLanguage?.trim())
        throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    return EDITORIAL_OPERATION.TRANSLATION;
}


export class EditorialCapabilityCatalog {
    constructor(
        private readonly articles: ArticleService,
        private readonly artifacts: ArtifactStore,
        private readonly publishing: PublishingService,
        private readonly editorial: EditorialService,
        private readonly styleCorpus: StyleCorpusService,
    ) { }


    definitions(): readonly EditorialCapabilityDefinition[] {
        return editorialCapabilityDefinitions;
    }


    read(input: ReadContext): unknown {
        const article = currentArticle(this.articles, input.context);
        switch (input.capability) {
            case EDITORIAL_CAPABILITY.INSPECT_ARTICLE:
                return article;
            case EDITORIAL_CAPABILITY.INSPECT_REVISIONS:
                return this.articles.listRevisions(article.id);
            case EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS:
                return this.artifacts.list(article.id).map(({ id, revisionId, kind, createdAt }) => ({ id, revisionId, kind, createdAt }));
            case EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE: {
                const settings = this.publishing.getSettings();
                const profileId = isPublishLimitProfileId(article.publishingProfileId) ? article.publishingProfileId : settings.defaultProfileId;
                return { settings, profile: getPublishLimitProfile(profileId, settings) };
            }
            case EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS: {
                const corpus = this.styleCorpus.get();
                return {
                    status: corpus.status,
                    itemCount: corpus.items.length,
                    rules: corpus.rules,
                    articleRules: this.styleCorpus.getArticleRules(article.id),
                    currentRevisionIncluded: corpus.items.some((item) => item.revisionId === article.currentRevisionId)
                };
            }
        }
    }


    action(capability: typeof EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS | typeof EDITORIAL_CAPABILITY.REBUILD_STYLE_PROFILE, context: EditorialCapabilityContext) {
        if (!context.authorizedActions?.includes(capability))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const article = currentArticle(this.articles, context);
        return capability === EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS
            ? this.styleCorpus.addArticleRevision(article.id, article.currentRevisionId)
            : this.styleCorpus.rebuild();
    }


    stream(input: StreamContext, signal: AbortSignal, staged = false): AsyncIterable<EditorialEngineEvent> {
        if (!isStreamCapability(input.capability))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        currentArticle(this.articles, input.context);
        const operation = operationFor(input);
        const request = {
            articleId: input.context.articleId,
            requestId: input.requestId,
            operation,
            authorContext: input.authorContext,
            ...(input.targetLanguage?.trim() ? { targetLanguage: input.targetLanguage.trim() } : {}),
            ...(input.articleContent !== undefined ? { articleContent: input.articleContent } : {}),
            ...(input.articleSelection ? { articleSelection: true } : {}),
            ...(input.surroundingArticleCharacterCount !== undefined ? { surroundingArticleCharacterCount: input.surroundingArticleCharacterCount } : {}),
        };

        return staged
            ? this.editorial.streamStaged(request, signal)
            : this.editorial.stream(request, signal);
    }
}
