import { APPLICATION_ERROR, ASSISTANT_EVENT, beginTimedTelemetryCapture, BUILT_IN_SKILL, EDITORIAL_OPERATION, HTTP_STATUS, isBuiltInSkillId, type ArticleRevision, type AssistantCheckpointDraftMode, type AssistantCheckpointPreview, type AssistantEditMode, type AssistantEvent, type AssistantMessage, type RestoreAssistantCheckpointResult, type TimedTelemetryCapture } from "@skladno/shared";

import { AssistantCapabilityLoop } from "./capabilities/assistant-capability-loop.js";
import { AssistantCompletion, getCompletedContent, getEditCandidate, getResponseKind } from "./completion/assistant-completion.js";
import { AssistantRequestPreparation } from "./requests/assistant-request-preparation.js";
import type { FactChecksStore } from "./fact-checks-store.js";
import type { PreparedAssistantRequest } from "./requests/prepared-assistant-request.js";
import type { AssistantServiceRequest } from "./requests/assistant-service-request.js";
import { getActivityForEditorialOperation } from "./capabilities/editorial-capability-catalog.js";
import { getReusableFactFindings } from "../editorial/fact-checking/reusable-fact-findings.js";
import type { AssistantStore } from "./assistant-store.js";
import { EDITORIAL_ENGINE_EVENT } from "../editorial/engine/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../editorial/engine/editorial-engine-error.js";
import type { EditorialEngineEvent } from "../editorial/engine/editorial-engine-event.js";
import type { StyleCorpusStore } from "../editorial/style/style-corpus-store.js";
import type { TelemetryObserver } from "../telemetry/telemetry-observer.js";
import { getConversationHistory } from "./requests/conversation-history.js";
import { streamWithAssistantDeadline } from "./requests/assistant-request-deadline.js";
import { normalizeGeneralSettings } from "../settings/application-settings-normalizers.js";
import type { SettingsStore } from "../settings/settings-store.js";
import { ApplicationServiceError } from "../errors/application-service-error.js";
import { AssistantCheckpointError, AssistantEditError } from "./assistant-store.js";
import type { ArticleService } from "../articles/article-service.js";


export type { AssistantServiceRequest } from "./requests/assistant-service-request.js";
export type { PreparedAssistantRequest } from "./requests/prepared-assistant-request.js";


interface AssistantServiceStores {
    settings: SettingsStore;
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
        private readonly articles: Pick<ArticleService, "describeContentChange">,
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


    getEditMode(articleId: string): AssistantEditMode {
        this.preparation.listMessages(articleId);
        const defaultMode = normalizeGeneralSettings(this.stores.settings.getSetting("application-general")?.value).defaultAssistantEditMode;
        return this.stores.assistant.getEditMode(articleId, defaultMode);
    }


    setEditMode(articleId: string, mode: AssistantEditMode): AssistantEditMode {
        this.preparation.listMessages(articleId);
        return this.stores.assistant.setEditMode(articleId, mode);
    }


    async applyEdit(articleId: string, messageId: string): Promise<ArticleRevision> {
        try {
            return this.stores.assistant.applyEdit(articleId, messageId, await this.describePendingEdit(articleId, messageId));
        } catch (error) {
            if (error instanceof AssistantEditError)
                throw new ApplicationServiceError(error.kind === "conflict" ? APPLICATION_ERROR.ASSISTANT_EDIT_CONFLICT : APPLICATION_ERROR.ASSISTANT_EDIT_INVALID, error.kind === "conflict" ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST);

            throw error;
        }
    }


    private async describePendingEdit(articleId: string, messageId: string): Promise<string | undefined> {
        const preview = this.stores.assistant.previewEdit(articleId, messageId);
        if (!preview)
            return undefined;

        const locale = normalizeGeneralSettings(this.stores.settings.getSetting("application-general")?.value).interfaceLocale;
        return this.articles.describeContentChange(preview.previousContent, preview.content, locale, new AbortController().signal);
    }


    rejectTranslation(articleId: string, editorialArtifactId: string): void {
        this.stores.assistant.rejectTranslation(articleId, editorialArtifactId);
    }


    previewCheckpoint(articleId: string, messageId: string): AssistantCheckpointPreview {
        return this.runCheckpoint(() => this.stores.assistant.previewCheckpoint(articleId, messageId));
    }


    restoreCheckpoint(articleId: string, messageId: string, tailToken: string, draftMode?: AssistantCheckpointDraftMode): RestoreAssistantCheckpointResult {
        return this.runCheckpoint(() => this.stores.assistant.restoreCheckpoint(articleId, messageId, tailToken, draftMode));
    }


    private runCheckpoint<T>(operation: () => T): T {
        try {
            return operation();
        } catch (error) {
            if (error instanceof AssistantCheckpointError) {
                const errorCode = error.kind === "conflict"
                    ? APPLICATION_ERROR.ASSISTANT_CHECKPOINT_CONFLICT
                    : APPLICATION_ERROR.ASSISTANT_CHECKPOINT_INVALID;
                const httpStatus = error.kind === "conflict"
                    ? HTTP_STATUS.CONFLICT
                    : HTTP_STATUS.BAD_REQUEST;

                throw new ApplicationServiceError(errorCode, httpStatus);
            }

            throw error;
        }
    }


    prepare(request: AssistantServiceRequest): PreparedAssistantRequest {
        const observed = beginTimedTelemetryCapture(this.telemetry);
        try {
            const prepared = this.preparation.prepare(request);
            prepared.editMode = this.getEditMode(prepared.articleId);
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

            const completedEvent = yield* this.consumeEditorialEvents(request, signal);

            if (!completedEvent && !signal.aborted)
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);

            if (signal.aborted) {
                this.stores.assistant.failRequest(request.requestId, "cancelled", "request_cancelled");
                this.captureStreamOutcome(observed, "cancelled", "cancelled");
                return;
            }

            if (completedEvent)
                yield* this.streamAssistantEvents(request, completedEvent, signal);

            this.captureStreamOutcome(observed, "completed");
        } catch (error) {
            this.handleStreamFailure(request, signal, observed, initialized, error);
            throw error;
        }
    }


    private getRequestTimeoutMs(): number | undefined {
        const timeout = normalizeGeneralSettings(this.stores.settings.getSetting("application-general")?.value).assistantRequestTimeoutMinutes;
        return timeout === "unlimited" ? undefined : timeout * 60000;
    }


    private async *consumeEditorialEvents(request: PreparedAssistantRequest, signal: AbortSignal): AsyncGenerator<AssistantEvent, EditorialEngineEvent | undefined> {
        let completedEvent: EditorialEngineEvent | undefined;
        const timeoutMs = this.getRequestTimeoutMs();
        const events = streamWithAssistantDeadline((requestSignal) => this.streamEditorialEvents(request, requestSignal), signal, timeoutMs);
        for await (const event of events) {
            if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED)
                completedEvent = event;
            else
                yield* this.streamAssistantEvents(request, event, signal);
        }

        return completedEvent;
    }


    private captureStreamOutcome(observed: TimedTelemetryCapture, outcome: "completed" | "cancelled" | "failed", failure?: "cancelled" | "unknown"): void {
        observed.capture({
            kind: "ai_operation_finished",
            operation: "assistant",
            outcome,
            elapsedMs: observed.elapsedMs(),
            ...(failure ? { failure } : {}),
        });
    }


    private handleStreamFailure(request: PreparedAssistantRequest, signal: AbortSignal, observed: TimedTelemetryCapture, initialized: boolean, error: unknown): void {
        const cancelled = signal.aborted;
        if (initialized)
            this.stores.assistant.failRequest(request.requestId, cancelled ? "cancelled" : "failed", cancelled ? "request_cancelled" : this.getErrorCode(error));

        this.captureStreamOutcome(observed, cancelled ? "cancelled" : "failed", cancelled ? "cancelled" : "unknown");
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
                !request.usesCapabilityLoop && request.operation
                    ? [{
                        type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY,
                        requestId: request.requestId,
                        activity: { summary: getActivityForEditorialOperation(request.operation), status: "started" as const }
                    }]
                    : []
            )
        ];
    }


    private streamEditorialEvents(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        return request.usesCapabilityLoop ? this.capabilityLoop.stream(request, signal) : this.streamEngineEvents(request, signal);
    }


    private async *streamAssistantEvents(request: PreparedAssistantRequest, event: EditorialEngineEvent, signal: AbortSignal): AsyncIterable<AssistantEvent> {
        switch (event.type) {
            case EDITORIAL_ENGINE_EVENT.TEXT_DELTA:
                yield { type: ASSISTANT_EVENT.TEXT_DELTA, requestId: request.requestId, delta: event.delta };
                return;
            case EDITORIAL_ENGINE_EVENT.TOOL_STATUS:
                yield { type: ASSISTANT_EVENT.TOOL_STATUS, requestId: request.requestId, tool: event.tool, status: event.status, ...(event.claims ? { claims: event.claims } : {}) };
                return;
            case EDITORIAL_ENGINE_EVENT.COMPLETED:
                yield* this.completeAssistantEvents(request, event, signal);
                return;
            default:
                return;
        }
    }


    private async *completeAssistantEvents(request: PreparedAssistantRequest, event: Extract<EditorialEngineEvent, { type: "completed" }>, signal: AbortSignal): AsyncIterable<AssistantEvent> {
        signal.throwIfAborted();

        await this.authorizeCompletedEdit(request, event, signal);

        const kind = request.directEditAuthorized && getEditCandidate(request, event) ? "edit_applied" : getResponseKind(request.completedCapability);
        for (const activity of request.capabilityActivities)
            yield { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity };

        yield { type: ASSISTANT_EVENT.STAGED_COMPLETION, requestId: request.requestId, completion: { responseKind: kind } };
        signal.throwIfAborted();
        const createdSkill = this.capabilityLoop.commitPendingSkill(request);
        const completion = this.persistAssistantCompletion(request, event, createdSkill);

        if (createdSkill)
            this.capabilityLoop.finishPendingSkill(request.requestId);

        if (!request.usesCapabilityLoop && request.operation)
            yield { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity: { summary: getActivityForEditorialOperation(request.operation), status: "completed" } };

        yield { type: ASSISTANT_EVENT.COMPLETED, requestId: request.requestId, ...completion };
    }


    private async authorizeCompletedEdit(request: PreparedAssistantRequest, event: Extract<EditorialEngineEvent, { type: "completed" }>, signal: AbortSignal): Promise<void> {
        if (request.completedCapability !== "generate_proposal")
            return;

        request.editCandidateAuthorized = await this.capabilityLoop.qualifiesReplacement(request, event.text, signal);
        if (request.editMode !== "direct")
            return;

        request.editIntentAuthorized ||= await this.capabilityLoop.authorizesArticleEditIntent(request, signal);
        if (request.editIntentAuthorized && !getEditCandidate(request, event))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_EDIT_INVALID, HTTP_STATUS.BAD_REQUEST);

        request.directEditAuthorized = request.editIntentAuthorized;
        if (request.directEditAuthorized) {
            const content = getCompletedContent(request, event.text);
            const locale = request.interfaceLocale ?? normalizeGeneralSettings(this.stores.settings.getSetting("application-general")?.value).interfaceLocale;
            request.editDescription = await this.articles.describeContentChange(request.articleContent, content, locale, signal);
        }
    }


    private persistAssistantCompletion(request: PreparedAssistantRequest, event: Extract<EditorialEngineEvent, { type: "completed" }>, createdSkill: ReturnType<AssistantCapabilityLoop["commitPendingSkill"]>): ReturnType<AssistantCompletion["persist"]> {
        try {
            return this.completion.persist(request, event);
        } catch (error) {
            if (createdSkill)
                this.capabilityLoop.rollbackCreatedSkill(createdSkill);

            this.capabilityLoop.finishPendingSkill(request.requestId);
            if (error instanceof AssistantEditError)
                throw new ApplicationServiceError(error.kind === "conflict" ? APPLICATION_ERROR.ASSISTANT_EDIT_CONFLICT : APPLICATION_ERROR.ASSISTANT_EDIT_INVALID, error.kind === "conflict" ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST);

            throw error;
        }
    }


    private streamEngineEvents(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const excerpt = this.getArticleExcerpt(request);
        if (request.resolvedSkillId)
            return request.engine.stream(this.createEngineRequest(request, excerpt), signal);

        return request.engine.streamConversation({ message: request.authorMessage, article: excerpt, scope: request.scope.kind, history: getConversationHistory(this.stores.assistant, request.articleId) }, signal);
    }


    private getArticleExcerpt(request: PreparedAssistantRequest): string {
        return request.scope.kind === "selection"
            ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
            : request.articleContent;
    }


    private createEngineRequest(request: PreparedAssistantRequest, excerpt: string) {
        if (!request.operation)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        return {
            operation: request.operation,
            article: excerpt,
            articleTitle: request.articleTitle,
            ...(request.scope.kind === "selection" ? { articleSelection: true } : {}),
            authorContext: request.authorMessage,
            skillId: isBuiltInSkillId(request.resolvedSkillId) ? request.resolvedSkillId : undefined,
            ...(request.scope.kind === "selection" ? { surroundingArticleCharacterCount: request.articleContent.length - excerpt.length } : {}),
            ...(request.publishingCharacterLimit ? { targetArticleCharacterLimit: request.publishingCharacterLimit } : {}),
            ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
            ...(request.resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW
                ? { styleProfile: this.stores.styleCorpus.getStyleCorpus().profile, articleStyleRules: this.stores.styleCorpus.getArticleStyleRules(request.articleId) }
                : {}
            ),
            ...(request.operation === EDITORIAL_OPERATION.FACT_CHECK ? { reusableFactFindings: getReusableFactFindings(this.stores.factChecks, request.articleId) } : {})
        };
    }


    private getErrorCode(error: unknown) {
        if (error instanceof ApplicationServiceError)
            return error.code;

        return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
            ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
            : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
    }
}
