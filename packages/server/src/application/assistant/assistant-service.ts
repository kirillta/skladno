import { APPLICATION_ERROR, ASSISTANT_EVENT, beginTimedTelemetryCapture, BUILT_IN_SKILL, EDITORIAL_OPERATION, type AssistantEvent, type AssistantMessage, type TimedTelemetryCapture } from "@skladno/shared";

import { AssistantCapabilityLoop } from "./capabilities/assistant-capability-loop.js";
import { AssistantCompletion, responseKind } from "./completion/assistant-completion.js";
import { AssistantRequestPreparation } from "./requests/assistant-request-preparation.js";
import type { FactChecksStore } from "./fact-checks-store.js";
import type { PreparedAssistantRequest } from "./requests/prepared-assistant-request.js";
import type { AssistantServiceRequest } from "./requests/assistant-service-request.js";
import { activityForEditorialOperation } from "./capabilities/editorial-capability-catalog.js";
import { reusableFactFindings } from "../editorial/fact-checking/reusable-fact-findings.js";
import type { AssistantStore } from "./assistant-store.js";
import { EDITORIAL_ENGINE_EVENT } from "../editorial/engine/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../editorial/engine/editorial-engine-error.js";
import type { EditorialEngineEvent } from "../editorial/engine/editorial-engine-event.js";
import type { StyleCorpusStore } from "../editorial/style/style-corpus-store.js";
import type { TelemetryObserver } from "../telemetry/telemetry-observer.js";
import { conversationHistory } from "./requests/conversation-history.js";


export type { AssistantServiceRequest } from "./requests/assistant-service-request.js";
export type { PreparedAssistantRequest } from "./requests/prepared-assistant-request.js";


interface AssistantServiceStores {
    assistant: AssistantStore;
    styleCorpus: StyleCorpusStore;
    factChecks: FactChecksStore;
}


export class AssistantService {
    private readonly startedAt = new Map<string, TimedTelemetryCapture>();


    private readonly preparation: AssistantRequestPreparation;


    private readonly capabilityLoop: AssistantCapabilityLoop;


    private readonly completion: AssistantCompletion;


    constructor(
        private readonly stores: AssistantServiceStores,
        private readonly telemetry: TelemetryObserver | undefined,
        preparation: AssistantRequestPreparation,
        capabilityLoop: AssistantCapabilityLoop,
        completion: AssistantCompletion,
    ) {
        this.preparation = preparation;
        this.capabilityLoop = capabilityLoop;
        this.completion = completion;
    }


    listMessages(articleId: string): AssistantMessage[] {
        return this.preparation.listMessages(articleId);
    }


    prepare(request: AssistantServiceRequest): PreparedAssistantRequest {
        const observed = beginTimedTelemetryCapture(this.telemetry);
        try {
            const prepared = this.preparation.prepare(request);
            this.startedAt.set(prepared.requestId, observed);
            return prepared;
        } catch (error) {
            observed.capture({
                kind: "ai_operation_finished",
                operation: "assistant",
                outcome: "failed",
                elapsedMs: observed.elapsedMs(),
                failure: "unknown"
            });

            throw error;
        }
    }


    async *stream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<AssistantEvent> {
        const observed = this.startedAt.get(request.requestId) ?? beginTimedTelemetryCapture(this.telemetry);
        this.startedAt.delete(request.requestId);
        let initialized = false;
        try {
            this.initializeRequest(request);
            initialized = true;
            yield* this.initialEvents(request);

            let completed = false;
            for await (const event of this.editorialStream(request, signal)) {
                completed ||= event.type === EDITORIAL_ENGINE_EVENT.COMPLETED;
                yield* this.assistantEvents(request, event);
            }

            if (!completed && !signal.aborted)
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);

            if (signal.aborted) {
                this.stores.assistant.failRequest(request.requestId, "cancelled", "request_cancelled");
                observed.capture({
                    kind: "ai_operation_finished",
                    operation: "assistant",
                    outcome: "cancelled",
                    elapsedMs: observed.elapsedMs(),
                    failure: "cancelled"
                });

                return;
            }

            observed.capture({
                kind: "ai_operation_finished",
                operation: "assistant",
                outcome: "completed",
                elapsedMs: observed.elapsedMs()
            });
        } catch (error) {
            if (initialized)
                this.stores.assistant.failRequest(request.requestId, signal.aborted ? "cancelled" : "failed", signal.aborted ? "request_cancelled" : this.errorCode(error));

            observed.capture({
                kind: "ai_operation_finished",
                operation: "assistant",
                outcome: signal.aborted ? "cancelled" : "failed",
                elapsedMs: observed.elapsedMs(),
                failure: signal.aborted ? "cancelled" : "unknown"
            });

            throw error;
        }
    }


    private initializeRequest(request: PreparedAssistantRequest): void {
        this.stores.assistant.createRequest({
            id: request.requestId,
            articleId: request.articleId,
            authorMessage: request.authorMessage,
            scope: request.scope,
            explicitSkillId: request.explicitSkillId,
            skillOffset: request.skillOffset,
            targetLanguage: request.targetLanguage,
            retryOfRequestId: request.retryOfRequestId
        });
        this.stores.assistant.resolveRequest(request.requestId, request.resolvedSkillId, request.explicitSkillId ? "explicit" : request.resolvedSkillId ? "inferred" : undefined);
    }


    private initialEvents(request: PreparedAssistantRequest): AssistantEvent[] {
        return [
            {
                type: ASSISTANT_EVENT.ACCEPTED,
                requestId: request.requestId
            },
            {
                type: ASSISTANT_EVENT.SKILL_RESOLVED,
                requestId: request.requestId,
                ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId, source: request.explicitSkillId ? "explicit" : "inferred" } : {})
            },
            ...(
                !request.usesCapabilityLoop
                    ? [{
                        type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY,
                        requestId: request.requestId,
                        activity: { summary: activityForEditorialOperation(request.operation), status: "started" as const }
                    }]
                    : []
            )
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

        return request.engine.streamConversation({ message: request.authorMessage, article: excerpt, scope: request.scope.kind, history: conversationHistory(this.stores.assistant, request.articleId) }, signal);
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
                ? { styleProfile: this.stores.styleCorpus.getStyleCorpus().profile, articleStyleRules: this.stores.styleCorpus.getArticleStyleRules(request.articleId) }
                : {}
            ),
            ...(request.operation === EDITORIAL_OPERATION.FACT_CHECK ? { reusableFactFindings: reusableFactFindings(this.stores.factChecks, request.articleId) } : {})
        };
    }


    private errorCode(error: unknown): typeof APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE | typeof APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED {
        return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
            ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
            : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
    }
}
