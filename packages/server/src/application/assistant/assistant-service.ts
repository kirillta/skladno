import { APPLICATION_ERROR, BUILT_IN_SKILL, builtInSkillScopeCompatibility, getPublishLimitProfile, HTTP_STATUS, isPublishLimitProfileId, type AssistantEditorialResult, type AssistantEvent, type AssistantMessage, type AssistantRequestScope, type AssistantResponseKind, type BuiltInSkillId, type EditorialOperation, type StartAssistantRequest } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { ArticleStore } from "../ports/article-store.js";
import type { AssistantArtifactStore } from "../ports/assistant-artifact-store.js";
import type { AssistantStore } from "../ports/assistant-store.js";
import { EDITORIAL_ENGINE_EVENT } from "../ports/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../ports/editorial-engine-error.js";
import type { EditorialEngine } from "../ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { StyleCorpusStore } from "../ports/style-corpus-store.js";


export interface AssistantServiceRequest extends StartAssistantRequest {
    articleId: string;
}


export interface PreparedAssistantRequest extends AssistantServiceRequest {
    articleContent: string;
    publishingCharacterLimit?: number;
    resolvedSkillId?: BuiltInSkillId;
    operation: EditorialOperation;
    engine: EditorialEngine;
}


function inferSkill(message: string, requestScope: AssistantRequestScope): BuiltInSkillId | undefined {
    const candidates: [BuiltInSkillId, RegExp][] = [
        [BUILT_IN_SKILL.FACT_CHECKING, /fact.?check|verify|source|citation/],
        [BUILT_IN_SKILL.STYLE_REVIEW, /style|voice|tone/],
        [BUILT_IN_SKILL.TRANSLATION, /translat/],
        [BUILT_IN_SKILL.TALKING_POINTS, /talking points|outline|bullet/],
        [BUILT_IN_SKILL.NARRATIVE_DRAFT, /narrative|write (?:a |the )?draft|turn .* into (?:an? )?article/],
        [BUILT_IN_SKILL.FLOW_AND_CLARITY, /flow|clarity|transition|readability|smooth/],
    ];
    const matched = candidates.filter(([skill, pattern]) => pattern.test(message.toLowerCase()) && builtInSkillScopeCompatibility[skill].includes(requestScope.kind));

    return matched.length === 1 ? matched[0]![0] : undefined;
}


function operationFor(skill: BuiltInSkillId): EditorialOperation {
    const operations: Record<BuiltInSkillId, EditorialOperation> = {
        talking_points: "thesis_to_narrative",
        narrative_draft: "thesis_to_narrative",
        flow_and_clarity: "flow_revision",
        fact_checking: "fact_check",
        style_review: "style_review",
        translation: "translation",
    };

    return operations[skill];
}


function responseKind(skill: BuiltInSkillId | undefined): AssistantResponseKind {
    if (!skill)
        return "editorial_conversation";

    if (skill === BUILT_IN_SKILL.FACT_CHECKING)
        return "findings_prepared";

    if (skill === BUILT_IN_SKILL.STYLE_REVIEW)
        return "proposal_and_findings_prepared";

    if (skill === BUILT_IN_SKILL.TRANSLATION)
        return "translation_proposal_prepared";

    return "proposal_prepared";
}


function completedContent(request: PreparedAssistantRequest, text: string): string {
    if (request.scope.kind !== "selection" || !request.resolvedSkillId || request.resolvedSkillId === BUILT_IN_SKILL.FACT_CHECKING)
        return text;

    return `${request.articleContent.slice(0, request.scope.startOffset)}${text}${request.articleContent.slice(request.scope.endOffset)}`;
}


function errorCode(error: unknown): typeof APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE | typeof APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED {
    return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
        ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
        : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}


export class AssistantService {
    constructor(
        private readonly articles: ArticleStore,
        private readonly assistant: AssistantStore,
        private readonly styleCorpus: StyleCorpusStore,
        private readonly artifacts: AssistantArtifactStore,
        private readonly engines: EditorialEngineResolver,
    ) { }


    listMessages(articleId: string): AssistantMessage[] {
        if (!this.articles.get(articleId))
            throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        return this.assistant.listMessages(articleId);
    }


    prepare(request: AssistantServiceRequest): PreparedAssistantRequest {
        const article = this.articles.get(request.articleId);
        if (!article)
            throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        if (article.currentRevisionId !== request.scope.baseRevisionId)
            throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

        if (request.explicitSkillId && !builtInSkillScopeCompatibility[request.explicitSkillId].includes(request.scope.kind))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_SCOPE_INCOMPATIBLE, HTTP_STATUS.BAD_REQUEST);

        if (request.retryOfRequestId && !this.assistant.getRequest(request.retryOfRequestId))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_RETRY_INVALID, HTTP_STATUS.BAD_REQUEST);

        const articleContent = article.currentRevision.content;
        if (request.scope.kind === "selection" && request.scope.endOffset > articleContent.length)
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);

        const resolvedSkillId = request.explicitSkillId ?? inferSkill(request.authorMessage, request.scope);
        if (resolvedSkillId === BUILT_IN_SKILL.TRANSLATION && !request.targetLanguage?.trim())
            throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

        if (resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW && !this.styleCorpus.get().profile)
            throw new ApplicationServiceError(APPLICATION_ERROR.STYLE_CORPUS_REQUIRED, HTTP_STATUS.BAD_REQUEST);

        const operation = operationFor(resolvedSkillId ?? BUILT_IN_SKILL.FLOW_AND_CLARITY);
        const engine = this.engines.resolve(operation, resolvedSkillId);
        if (!engine)
            throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

        const publishingCharacterLimit = isPublishLimitProfileId(article.publishingProfileId)
            ? getPublishLimitProfile(article.publishingProfileId).characterLimit
            : undefined;

        return { ...request, articleContent, ...(publishingCharacterLimit ? { publishingCharacterLimit } : {}), resolvedSkillId, operation, engine };
    }


    async *stream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<AssistantEvent> {
        this.assistant.createRequest({ id: request.requestId, articleId: request.articleId, scope: request.scope, explicitSkillId: request.explicitSkillId, skillOffset: request.skillOffset, retryOfRequestId: request.retryOfRequestId });
        this.assistant.setAuthorMessage(request.requestId, request.authorMessage);
        this.assistant.resolveRequest(request.requestId, request.resolvedSkillId, request.explicitSkillId ? "explicit" : request.resolvedSkillId ? "inferred" : undefined);

        yield { type: "accepted", requestId: request.requestId };
        yield { type: "skill_resolved", requestId: request.requestId, ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId, source: request.explicitSkillId ? "explicit" : "inferred" } : {}) };

        let completed = false;
        try {
            for await (const event of this.engineStream(request, signal)) {
                if (event.type === EDITORIAL_ENGINE_EVENT.TEXT_DELTA) {
                    yield { type: "text_delta", requestId: request.requestId, delta: event.delta };
                } else if (event.type === EDITORIAL_ENGINE_EVENT.TOOL_STATUS) {
                    yield { type: "tool_status", requestId: request.requestId, tool: event.tool, status: event.status };
                } else {
                    completed = true;
                    yield { type: "completed", requestId: request.requestId, ...this.persistCompletion(request, event) };
                }
            }

            if (!completed && !signal.aborted)
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, "The Assistant stream ended before completing.");
        } catch (error) {
            this.assistant.failRequest(request.requestId, signal.aborted ? "cancelled" : "failed", signal.aborted ? "request_cancelled" : errorCode(error));
            throw error;
        }

        if (signal.aborted)
            this.assistant.failRequest(request.requestId, "cancelled", "request_cancelled");
    }


    private engineStream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const excerpt = request.scope.kind === "selection"
            ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
            : request.articleContent;
        if (request.resolvedSkillId)
            return request.engine.stream({
                operation: request.operation,
                article: excerpt,
                ...(request.scope.kind === "selection" ? { articleSelection: true } : {}),
                authorContext: request.authorMessage,
                skillId: request.resolvedSkillId,
                ...(request.scope.kind === "selection" ? { surroundingArticleCharacterCount: request.articleContent.length - excerpt.length } : {}),
                ...(request.publishingCharacterLimit ? { targetArticleCharacterLimit: request.publishingCharacterLimit } : {}),
                ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
                ...(request.resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW ? { styleProfile: this.styleCorpus.get().profile } : {})
            }, signal);

        const history = this.assistant.listMessages(request.articleId)
            .flatMap((message) => message.role === "author" || (message.role === "assistant" && message.kind === "response") ? message.content ? [{ role: message.role, content: message.content }] : [] : []);

        return request.engine.streamConversation({ message: request.authorMessage, article: excerpt, scope: request.scope.kind, history }, signal);
    }


    private persistCompletion(request: PreparedAssistantRequest, event: Extract<EditorialEngineEvent, { type: "completed" }>): Omit<Extract<AssistantEvent, { type: "completed" }>, "type" | "requestId"> {
        const content = completedContent(request, event.text);
        const kind = responseKind(request.resolvedSkillId);
        const artifactId = request.resolvedSkillId
            ? this.artifacts.create({
                articleId: request.articleId,
                revisionId: request.scope.baseRevisionId,
                kind: request.resolvedSkillId === BUILT_IN_SKILL.FACT_CHECKING ? "fact-check" : "assistant-proposal",
                content: JSON.stringify({
                    requestId: request.requestId,
                    resolvedSkillId: request.resolvedSkillId,
                    skillSource: request.explicitSkillId ? "explicit" : "inferred",
                    authorGuidance: request.authorMessage,
                    scope: request.scope,
                    responseId: event.responseId,
                    proposal: content, findings: event.factCheck ?? event.styleReview,
                    translation: event.translation
                })
            }).id
            : undefined;
        const message = this.assistant.completeRequest({ requestId: request.requestId, articleId: request.articleId, skillId: request.resolvedSkillId, responseKind: kind, content: request.resolvedSkillId ? "" : content, editorialArtifactId: artifactId });
        const result: AssistantEditorialResult | undefined = request.resolvedSkillId
            ? {
                ...(request.resolvedSkillId === BUILT_IN_SKILL.FACT_CHECKING && event.factCheck ? { factCheck: event.factCheck } : {}),
                ...(request.resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW ? { proposal: content, ...(event.styleReview ? { styleReview: event.styleReview } : {}) } : {}),
                ...(request.resolvedSkillId === BUILT_IN_SKILL.TRANSLATION && event.translation ? { translation: { metadata: event.translation, content } } : {}),
                ...(request.resolvedSkillId === BUILT_IN_SKILL.TALKING_POINTS || request.resolvedSkillId === BUILT_IN_SKILL.NARRATIVE_DRAFT || request.resolvedSkillId === BUILT_IN_SKILL.FLOW_AND_CLARITY ? { proposal: content } : {}),
            }
            : undefined;

        return { responseKind: kind, messageId: message.id, ...(artifactId ? { editorialArtifactId: artifactId } : {}), ...(result ? { result } : {}) };
    }
}
