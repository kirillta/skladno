import { APPLICATION_ERROR, ASSISTANT_EVENT, BUILT_IN_SKILL, EDITORIAL_OPERATION, type AssistantEvent, type AssistantMessage } from "@skladno/shared";

import { AssistantCapabilityLoop } from "./assistant-capability-loop.js";
import { AssistantCompletion, responseKind } from "./assistant-completion.js";
import { AssistantRequestPreparation } from "./assistant-request-preparation.js";
import type { AssistantServiceRequest, FactChecksStore, PreparedAssistantRequest } from "./assistant-service-types.js";
import { activityForEditorialOperation, type EditorialCapabilityCatalog } from "./editorial-capability-catalog.js";
import type { ArticleStore } from "../ports/article-store.js";
import type { AssistantArtifactStore } from "../ports/assistant-artifact-store.js";
import type { AssistantStore } from "../ports/assistant-store.js";
import { EDITORIAL_ENGINE_EVENT } from "../ports/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../ports/editorial-engine-error.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { StyleCorpusStore } from "../ports/style-corpus-store.js";


export type { AssistantServiceRequest, PreparedAssistantRequest } from "./assistant-service-types.js";


export class AssistantService {
    private readonly preparation: AssistantRequestPreparation;


    private readonly capabilityLoop: AssistantCapabilityLoop;


    private readonly completion: AssistantCompletion;


    constructor(
        articles: ArticleStore,
        private readonly assistant: AssistantStore,
        private readonly styleCorpus: StyleCorpusStore,
        artifacts: AssistantArtifactStore,
        engines: EditorialEngineResolver,
        factChecks: FactChecksStore = { list: () => [], save: () => undefined },
        capabilities?: EditorialCapabilityCatalog,
    ) {
        this.preparation = new AssistantRequestPreparation({ articles, assistant, styleCorpus, engines, factChecks, capabilities });
        this.capabilityLoop = new AssistantCapabilityLoop({ assistant, engines, capabilities, conversationHistory: (articleId, limit) => this.conversationHistory(articleId, limit) });
        this.completion = new AssistantCompletion({ articles, assistant, styleCorpus, artifacts, factChecks, capabilities });
    }


    listMessages(articleId: string): AssistantMessage[] {
        return this.preparation.listMessages(articleId);
    }


    prepare(request: AssistantServiceRequest): PreparedAssistantRequest {
        return this.preparation.prepare(request);
    }


    async *stream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<AssistantEvent> {
        this.initializeRequest(request);
        yield* this.initialEvents(request);

        let completed = false;
        try {
            for await (const event of this.editorialStream(request, signal)) {
                completed ||= event.type === EDITORIAL_ENGINE_EVENT.COMPLETED;
                yield* this.assistantEvents(request, event);
            }

            if (!completed && !signal.aborted)
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);
        } catch (error) {
            this.assistant.failRequest(request.requestId, signal.aborted ? "cancelled" : "failed", signal.aborted ? "request_cancelled" : this.errorCode(error));
            throw error;
        }

        if (signal.aborted)
            this.assistant.failRequest(request.requestId, "cancelled", "request_cancelled");
    }


    private initializeRequest(request: PreparedAssistantRequest): void {
        this.assistant.createRequest({
            id: request.requestId,
            articleId: request.articleId,
            authorMessage: request.authorMessage,
            scope: request.scope,
            explicitSkillId: request.explicitSkillId,
            skillOffset: request.skillOffset,
            targetLanguage: request.targetLanguage,
            retryOfRequestId: request.retryOfRequestId
        });
        this.assistant.resolveRequest(request.requestId, request.resolvedSkillId, request.explicitSkillId ? "explicit" : request.resolvedSkillId ? "inferred" : undefined);
    }


    private initialEvents(request: PreparedAssistantRequest): AssistantEvent[] {
        return [
            { type: ASSISTANT_EVENT.ACCEPTED, requestId: request.requestId },
            {
                type: ASSISTANT_EVENT.SKILL_RESOLVED,
                requestId: request.requestId,
                ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId, source: request.explicitSkillId ? "explicit" : "inferred" } : {})
            },
            ...(!request.usesCapabilityLoop ? [{ type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity: { summary: activityForEditorialOperation(request.operation), status: "started" as const } }] : [])
        ];
    }


    private editorialStream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        return request.usesCapabilityLoop ? this.capabilityLoop.stream(request, signal) : this.engineStream(request, signal);
    }


    private async *assistantEvents(request: PreparedAssistantRequest, event: EditorialEngineEvent): AsyncIterable<AssistantEvent> {
        if (event.type === EDITORIAL_ENGINE_EVENT.TEXT_DELTA)
            yield { type: ASSISTANT_EVENT.TEXT_DELTA, requestId: request.requestId, delta: event.delta };

        if (event.type === EDITORIAL_ENGINE_EVENT.TOOL_STATUS)
            yield { type: ASSISTANT_EVENT.TOOL_STATUS, requestId: request.requestId, tool: event.tool, status: event.status, ...(event.claims ? { claims: event.claims } : {}) };

        if (event.type !== EDITORIAL_ENGINE_EVENT.COMPLETED)
            return;

        const kind = responseKind(request.completedCapability);
        for (const activity of request.capabilityActivities)
            yield { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity };

        yield { type: ASSISTANT_EVENT.STAGED_COMPLETION, requestId: request.requestId, completion: { responseKind: kind } };
        const completion = this.completion.persist(request, event);
        if (!request.usesCapabilityLoop)
            yield { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity: { summary: activityForEditorialOperation(request.operation), status: "completed" } };

        yield { type: ASSISTANT_EVENT.COMPLETED, requestId: request.requestId, ...completion };
    }


    private engineStream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const excerpt = this.articleExcerpt(request);
        if (request.resolvedSkillId)
            return request.engine.stream(this.engineRequest(request, excerpt), signal);

        return request.engine.streamConversation({ message: request.authorMessage, article: excerpt, scope: request.scope.kind, history: this.conversationHistory(request.articleId) }, signal);
    }


    private articleExcerpt(request: PreparedAssistantRequest): string {
        return request.scope.kind === "selection"
            ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
            : request.articleContent;
    }


    private engineRequest(request: PreparedAssistantRequest, excerpt: string) {
        return {
            operation: request.operation,
            article: excerpt,
            ...(request.operation === EDITORIAL_OPERATION.TRANSLATION ? { articleTitle: request.articleTitle } : {}),
            ...(request.scope.kind === "selection" ? { articleSelection: true } : {}),
            authorContext: request.authorMessage,
            skillId: request.resolvedSkillId!,
            ...(request.scope.kind === "selection" ? { surroundingArticleCharacterCount: request.articleContent.length - excerpt.length } : {}),
            ...(request.publishingCharacterLimit ? { targetArticleCharacterLimit: request.publishingCharacterLimit } : {}),
            ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
            ...(request.resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW
                ? { styleProfile: this.styleCorpus.get().profile, articleStyleRules: this.styleCorpus.getArticleRules(request.articleId) }
                : {}
            ),
            ...(request.reusableFactFindings ? { reusableFactFindings: request.reusableFactFindings } : {})
        };
    }


    private conversationHistory(articleId: string, limit?: number): { role: "author" | "assistant"; content: string }[] {
        const history = this.assistant.listMessages(articleId).flatMap((message) => {
            const isHistoryMessage = message.role === "author" || (message.role === "assistant" && message.kind === "response");
            if (!isHistoryMessage || !message.content)
                return [];

            return [{ role: message.role === "author" ? "author" as const : "assistant" as const, content: message.content }];
        });

        return limit === undefined ? history : history.slice(-limit);
    }


    private errorCode(error: unknown): typeof APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE | typeof APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED {
        return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
            ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
            : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
    }
}
