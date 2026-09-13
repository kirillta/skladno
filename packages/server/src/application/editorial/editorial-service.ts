import {
    APPLICATION_ERROR,
    beginTimedTelemetryCapture,
    EDITORIAL_OPERATION,
    HTTP_STATUS,
    type Article,
    type CreateEditorialArtifactInput,
    type EditorialArtifact,
    type EditorialOperation,
    type FactCheck,
    type StyleProfile
} from "@skladno/shared";
import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { EditorialEngine } from "./engine/editorial-engine.js";
import type { EditorialEngineEvent } from "./engine/editorial-engine-event.js";
import { EDITORIAL_ENGINE_ERROR } from "./engine/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "./engine/editorial-engine-events.js";
import { EditorialEngineError } from "./engine/editorial-engine-error.js";
import type { EditorialEngineResolver } from "./engine/editorial-engine-resolver.js";
import type { EditorialServiceRequest } from "./editorial-request.js";
import { getReusableFactFindings } from "./fact-checking/reusable-fact-findings.js";
import { persistFactCheckArtifact } from "./fact-checking/persist-fact-check-artifact.js";
import type { FactCheckArtifactStore } from "./fact-checking/fact-check-artifact-store.js";
import type { TelemetryObserver } from "../telemetry/telemetry-observer.js";


interface EditorialStreamContext {
    article: Article;
    engine: EditorialEngine;
    factCheck: boolean;
    translation: boolean;
    styleProfile?: StyleProfile;
    articleStyleRules?: string;
    previousResponseId?: string;
    continuationScope?: { connectionId: string; provider: import("@skladno/shared").AiProvider; model: string };
}


interface EditorialArticleStore {
    getArticle(articleId: string): Article | undefined;
}


interface EditorialSessionStore {
    getEditorialSession(articleId: string): import("@skladno/shared").EditorialSession | undefined;
    saveEditorialSession(articleId: string, session: Pick<import("@skladno/shared").EditorialSession, "continuationToken" | "connectionId" | "provider" | "model">): void;
    removeEditorialSession(articleId: string): void;
}


interface EditorialStyleCorpusStore {
    getStyleCorpus(): { profile?: StyleProfile; status: "empty" | "outdated" | "ready" };
    getArticleStyleRules(articleId: string): string;
}


interface EditorialArtifactsStore extends FactCheckArtifactStore {
    createEditorialArtifact(input: CreateEditorialArtifactInput): EditorialArtifact;
}


interface FactChecksStore { listFactChecks(articleId: string): FactCheck[]; saveFactCheckRun(artifactId: string, articleId: string, revisionId: string): void; }


interface EditorialServiceStores {
    articles: EditorialArticleStore;
    sessions: EditorialSessionStore;
    styleCorpus: EditorialStyleCorpusStore;
    artifacts: EditorialArtifactsStore;
    factChecks: FactChecksStore;
}


interface EditorialServiceRuntime {
    engines: EditorialEngineResolver;
    sessionContinuationEnabled: boolean;
}


function prepareEditorialStream(articles: EditorialArticleStore, sessions: EditorialSessionStore, styleCorpus: EditorialStyleCorpusStore, engines: EditorialEngineResolver, sessionContinuationEnabled: boolean, request: EditorialServiceRequest): EditorialStreamContext {
    const article = articles.getArticle(request.articleId);
    if (!article)
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    const factCheck = request.operation === EDITORIAL_OPERATION.FACT_CHECK;
    const translation = request.operation === EDITORIAL_OPERATION.TRANSLATION;
    const corpus = request.operation === EDITORIAL_OPERATION.STYLE_REVIEW ? styleCorpus.getStyleCorpus() : undefined;
    const styleProfile = corpus?.profile;
    if (request.operation === EDITORIAL_OPERATION.STYLE_REVIEW && (corpus?.status !== "ready" || !styleProfile))
        throw new ApplicationServiceError(APPLICATION_ERROR.STYLE_CORPUS_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    const engine = engines.resolve(request.operation, request.skillId);
    if (!engine)
        throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

    const continuationScope = engine.continuationScope;
    const session = !factCheck && !translation && sessionContinuationEnabled ? sessions.getEditorialSession(request.articleId) : undefined;
    const previousResponseId = session?.continuationToken
        && continuationScope
        && session.connectionId === continuationScope.connectionId
        && session.provider === continuationScope.provider
        && session.model === continuationScope.model
        ? session.continuationToken
        : undefined;

    if (!sessionContinuationEnabled || (session && !previousResponseId))
        sessions.removeEditorialSession(request.articleId);

    return {
        article,
        engine,
        factCheck,
        translation,
        ...(styleProfile ? { styleProfile } : {}),
        ...(styleProfile ? { articleStyleRules: styleCorpus.getArticleStyleRules(request.articleId) } : {}),
        ...(continuationScope ? { continuationScope } : {}),
        ...(previousResponseId ? { previousResponseId } : {}),
    };
}


function createEngineRequest(request: EditorialServiceRequest, context: EditorialStreamContext, factChecks: FactChecksStore) {
    return {
        operation: request.operation,
        article: request.articleContent ?? context.article.currentRevision.content,
        ...(request.operation === EDITORIAL_OPERATION.TRANSLATION ? { articleTitle: context.article.title } : {}),
        ...(request.articleSelection ? { articleSelection: true } : {}),
        ...(request.surroundingArticleCharacterCount !== undefined ? { surroundingArticleCharacterCount: request.surroundingArticleCharacterCount } : {}),
        authorContext: request.authorContext,
        ...(request.skillId ? { skillId: request.skillId } : {}),
        ...(request.targetArticleCharacterLimit ? { targetArticleCharacterLimit: request.targetArticleCharacterLimit } : {}),
        ...(context.styleProfile ? { styleProfile: context.styleProfile } : {}),
        ...(context.styleProfile ? { articleStyleRules: context.articleStyleRules } : {}),
        ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
        ...(context.previousResponseId ? { previousResponseId: context.previousResponseId } : {}),
        ...(context.factCheck ? { reusableFactFindings: getReusableFactFindings(factChecks, request.articleId) } : {}),
    };
}


function getEditorialArtifactKind(operation: EditorialOperation, factCheck: boolean): "fact-check" | "style-review" | "editorial-proposal" {
    if (factCheck)
        return "fact-check";

    return operation === EDITORIAL_OPERATION.STYLE_REVIEW ? "style-review" : "editorial-proposal";
}


function createEditorialArtifactMetadata(request: EditorialServiceRequest, context: EditorialStreamContext, event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>, includeFactCheck = true) {
    return {
        requestId: request.requestId,
        operation: request.operation,
        authorContext: request.authorContext,
        ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
        responseId: event.responseId,
        proposal: event.text,
        styleProfile: context.styleProfile,
        articleStyleRules: context.articleStyleRules,
        findings: event.styleReview?.findings,
        ...(includeFactCheck ? { factCheck: event.factCheck } : {}),
        translation: event.translation,
    };
}


function persistCompletedEditorialOutput(sessions: EditorialSessionStore, artifacts: EditorialArtifactsStore, factChecks: FactChecksStore, request: EditorialServiceRequest, context: EditorialStreamContext, sessionContinuationEnabled: boolean, event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>): string {
    if (!context.factCheck && !context.translation && sessionContinuationEnabled && event.continuationToken && context.continuationScope)
        sessions.saveEditorialSession(request.articleId, { continuationToken: event.continuationToken, ...context.continuationScope });

    if (!context.factCheck)
        return artifacts.createEditorialArtifact({
            articleId: request.articleId,
            revisionId: context.article.currentRevisionId,
            kind: getEditorialArtifactKind(request.operation, context.factCheck),
            content: JSON.stringify(createEditorialArtifactMetadata(request, context, event)),
        }).id;

    return persistFactCheckArtifact({
        artifacts,
        factChecks,
        articleId: request.articleId,
        revisionId: context.article.currentRevisionId,
        metadata: createEditorialArtifactMetadata(request, context, event, false),
        factCheck: event.factCheck!,
    }).artifactId;
}


async function* streamEditorialOperation(request: EditorialServiceRequest, context: EditorialStreamContext, factChecks: FactChecksStore, signal: AbortSignal, onCompleted: (event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>) => string | undefined): AsyncIterable<EditorialEngineEvent> {
    let completed = false;
    for await (const event of context.engine.stream(createEngineRequest(request, context, factChecks), signal)) {
        if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED) {
            completed = true;
            const editorialArtifactId = onCompleted(event);
            yield { ...event, ...(editorialArtifactId ? { editorialArtifactId } : {}) };

            continue;
        }

        yield event;
    }

    if (!completed && !signal.aborted)
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);
}


export class EditorialService {
    constructor(
        private readonly stores: EditorialServiceStores,
        private readonly runtime: EditorialServiceRuntime,
        private readonly telemetry?: TelemetryObserver,
    ) { }


    async *stream(request: EditorialServiceRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const observed = beginTimedTelemetryCapture(this.telemetry);

        try {
            const context = prepareEditorialStream(this.stores.articles, this.stores.sessions, this.stores.styleCorpus, this.runtime.engines, this.runtime.sessionContinuationEnabled, request);
            yield* streamEditorialOperation(
                request,
                context,
                this.stores.factChecks,
                signal,
                (event) => persistCompletedEditorialOutput(this.stores.sessions, this.stores.artifacts, this.stores.factChecks, request, context, this.runtime.sessionContinuationEnabled, event),
            );
            observed.capture({ kind: "ai_operation_finished", operation: request.operation, outcome: signal.aborted ? "cancelled" : "completed", elapsedMs: observed.elapsedMs(), ...(signal.aborted ? { failure: "cancelled" as const } : {}) });
        } catch (error) {
            if (error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED)
                this.stores.sessions.removeEditorialSession(request.articleId);

            observed.capture({ kind: "ai_operation_finished", operation: request.operation, outcome: signal.aborted ? "cancelled" : "failed", elapsedMs: observed.elapsedMs(), failure: signal.aborted ? "cancelled" : "unknown" });
            throw error;
        }
    }


    async *streamStaged(request: EditorialServiceRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const context = prepareEditorialStream(this.stores.articles, this.stores.sessions, this.stores.styleCorpus, this.runtime.engines, this.runtime.sessionContinuationEnabled, request);

        try {
            yield* streamEditorialOperation(request, context, this.stores.factChecks, signal, () => undefined);
        } catch (error) {
            if (error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED)
                this.stores.sessions.removeEditorialSession(request.articleId);

            throw error;
        }
    }
}
