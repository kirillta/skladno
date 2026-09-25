import { APPLICATION_ERROR, ASSISTANT_EVENT, beginTimedTelemetryCapture, HTTP_STATUS, type AssistantEvent, type AssistantMessage, type TimedTelemetryCapture } from "@skladno/shared";

import { AssistantCapabilityLoop } from "./capabilities/assistant-capability-loop.js";
import { AssistantCompletion, getCompletedContent, getEditCandidate, getResponseKind } from "./completion/assistant-completion.js";
import { AssistantRequestPreparation } from "./requests/assistant-request-preparation.js";
import type { FactChecksStore } from "./fact-checks-store.js";
import type { PreparedAssistantRequest } from "./requests/prepared-assistant-request.js";
import type { AssistantServiceRequest } from "./requests/assistant-service-request.js";
import { getActivityForEditorialOperation } from "./capabilities/editorial-capability-catalog.js";
import type { AssistantStore } from "./assistant-store.js";
import { EDITORIAL_ENGINE_EVENT } from "../editorial/engine/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../editorial/engine/editorial-engine-error.js";
import type { EditorialEngineEvent } from "../editorial/engine/editorial-engine-event.js";
import type { StyleCorpusStore } from "../editorial/style/style-corpus-store.js";
import type { TelemetryObserver } from "../telemetry/telemetry-observer.js";
import { streamWithAssistantDeadline } from "./requests/assistant-request-deadline.js";
import { normalizeGeneralSettings } from "../settings/application-settings-normalizers.js";
import type { SettingsStore } from "../settings/settings-store.js";
import { ApplicationServiceError } from "../errors/application-service-error.js";
import { AssistantEditError } from "./assistant-store.js";
import { streamAssistantEngineEvents } from "./assistant-engine-request.js";
import { AssistantEditService } from "./assistant-edit-service.js";


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


    private readonly edits: AssistantEditService;


    constructor(
        private readonly stores: AssistantServiceStores,
        private readonly articles: ConstructorParameters<typeof AssistantEditService>[2],
        private readonly telemetry: TelemetryObserver | undefined,
        preparation: AssistantRequestPreparation,
        capabilityLoop: AssistantCapabilityLoop,
        completion: AssistantCompletion,
    ) {
        this.preparation = preparation;
        this.capabilityLoop = capabilityLoop;
        this.completion = completion;
        this.edits = new AssistantEditService(stores.assistant, stores.settings, articles);
    }


    listMessages(articleId: string): AssistantMessage[] {
        return this.preparation.listMessages(articleId);
    }


    getEditMode(articleId: string) {
        this.preparation.listMessages(articleId);
        return this.edits.getEditMode(articleId);
    }


    setEditMode(articleId: string, mode: Parameters<AssistantEditService["setEditMode"]>[1]) {
        this.preparation.listMessages(articleId);
        return this.edits.setEditMode(articleId, mode);
    }


    applyEdit(articleId: string, messageId: string) {
        return this.edits.applyEdit(articleId, messageId);
    }


    rejectTranslation(articleId: string, editorialArtifactId: string) {
        this.edits.rejectTranslation(articleId, editorialArtifactId);
    }


    previewCheckpoint(articleId: string, messageId: string) {
        return this.edits.previewCheckpoint(articleId, messageId);
    }


    restoreCheckpoint(articleId: string, messageId: string, tailToken: string, draftMode?: Parameters<AssistantEditService["restoreCheckpoint"]>[3]) {
        return this.edits.restoreCheckpoint(articleId, messageId, tailToken, draftMode);
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
            this.rollbackSkillCompletion(request.requestId, createdSkill);
            if (error instanceof AssistantEditError)
                throw new ApplicationServiceError(error.kind === "conflict" ? APPLICATION_ERROR.ASSISTANT_EDIT_CONFLICT : APPLICATION_ERROR.ASSISTANT_EDIT_INVALID, error.kind === "conflict" ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST);

            throw error;
        }
    }


    private rollbackSkillCompletion(requestId: string, createdSkill: ReturnType<AssistantCapabilityLoop["commitPendingSkill"]>): void {
        if (createdSkill)
            this.capabilityLoop.rollbackCreatedSkill(createdSkill);

        this.capabilityLoop.finishPendingSkill(requestId);
    }


    private streamEngineEvents(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        return streamAssistantEngineEvents(request, this.stores, signal);
    }


    private getErrorCode(error: unknown) {
        if (error instanceof ApplicationServiceError)
            return error.code;

        return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
            ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
            : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
    }
}
