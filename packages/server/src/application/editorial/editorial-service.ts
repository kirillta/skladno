import { APPLICATION_ERROR, EDITORIAL_OPERATION, HTTP_STATUS, type Article, type CreateEditorialArtifactInput, type EditorialOperation, type StyleProfile } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { EditorialEngine } from "../ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";
import { EDITORIAL_ENGINE_ERROR } from "../ports/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../ports/editorial-engine-events.js";
import { EditorialEngineError } from "../ports/editorial-engine-error.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { EditorialServiceRequest } from "./editorial-request.js";


interface EditorialStreamContext {
    article: Article;
    engine: EditorialEngine;
    factCheck: boolean;
    translation: boolean;
    styleProfile?: StyleProfile;
    previousResponseId?: string;
}


interface EditorialArticleStore {
    get(articleId: string): Article | undefined;
}


interface EditorialSessionStore {
    get(articleId: string): { previousResponseId?: string } | undefined;
    save(articleId: string, responseId: string): void;
    remove(articleId: string): void;
}


interface EditorialStyleCorpusStore {
    get(): { profile?: StyleProfile };
}


interface EditorialArtifactsStore {
    create(input: CreateEditorialArtifactInput): unknown;
    createWithCitations(input: CreateEditorialArtifactInput, citations: Omit<import("@skladno/shared").CreateSourceCitationInput, "editorialArtifactId">[]): unknown;
}


function prepareEditorialStream(articles: EditorialArticleStore, sessions: EditorialSessionStore, styleCorpus: EditorialStyleCorpusStore, engines: EditorialEngineResolver, sessionContinuationEnabled: boolean, request: EditorialServiceRequest): EditorialStreamContext {
    const article = articles.get(request.articleId);
    if (!article)
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    const factCheck = request.operation === EDITORIAL_OPERATION.FACT_CHECK;
    const translation = request.operation === EDITORIAL_OPERATION.TRANSLATION;
    const session = !factCheck && !translation && sessionContinuationEnabled
        ? sessions.get(request.articleId)
        : undefined;

    if (!sessionContinuationEnabled)
        sessions.remove(request.articleId);

    const styleProfile = request.operation === EDITORIAL_OPERATION.STYLE_REVIEW ? styleCorpus.get().profile : undefined;
    if (request.operation === EDITORIAL_OPERATION.STYLE_REVIEW && !styleProfile)
        throw new ApplicationServiceError(APPLICATION_ERROR.STYLE_CORPUS_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    const engine = engines.resolve(request.operation);
    if (!engine)
        throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

    return {
        article,
        engine,
        factCheck,
        translation,
        ...(styleProfile ? { styleProfile } : {}),
        ...(session?.previousResponseId ? { previousResponseId: session.previousResponseId } : {}),
    };
}


function engineRequest(request: EditorialServiceRequest, context: EditorialStreamContext) {
    return {
        operation: request.operation,
        article: context.article.currentRevision.content,
        authorContext: request.authorContext,
        ...(context.styleProfile ? { styleProfile: context.styleProfile } : {}),
        ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
        ...(context.previousResponseId ? { previousResponseId: context.previousResponseId } : {}),
    };
}


function artifactKind(operation: EditorialOperation, factCheck: boolean): "fact-check" | "style-review" | "editorial-proposal" {
    if (factCheck)
        return "fact-check";

    return operation === EDITORIAL_OPERATION.STYLE_REVIEW ? "style-review" : "editorial-proposal";
}


function artifactInput(request: EditorialServiceRequest, context: EditorialStreamContext, event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>): CreateEditorialArtifactInput {
    return {
        articleId: request.articleId,
        revisionId: context.article.currentRevisionId,
        kind: artifactKind(request.operation, context.factCheck),
        content: JSON.stringify({
            requestId: request.requestId,
            operation: request.operation,
            authorContext: request.authorContext,
            ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
            responseId: event.responseId,
            proposal: event.text,
            styleProfile: context.styleProfile,
            findings: event.styleReview?.findings,
            factCheck: event.factCheck,
            translation: event.translation,
        }),
    };
}


function citationsFor(event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>) {
    return event.factCheck?.findings.flatMap((finding) => finding.sources.map((source) => ({
        url: source.url,
        title: source.title,
        excerpt: source.excerpt,
        uncertainty: `${source.quality}${source.publishedAt ? `; published ${source.publishedAt}` : ""}; ${finding.uncertainty}`,
    }))) ?? [];
}


function persistCompletedEditorialOutput(sessions: EditorialSessionStore, artifacts: EditorialArtifactsStore, request: EditorialServiceRequest, context: EditorialStreamContext, sessionContinuationEnabled: boolean, event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>): void {
    if (!context.factCheck && !context.translation && sessionContinuationEnabled)
        sessions.save(request.articleId, event.responseId);

    const input = artifactInput(request, context, event);
    if (context.factCheck)
        artifacts.createWithCitations(input, citationsFor(event));
    else
        artifacts.create(input);
}


async function* streamEditorialOperation(request: EditorialServiceRequest, context: EditorialStreamContext, signal: AbortSignal, onCompleted: (event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>) => void): AsyncIterable<EditorialEngineEvent> {
    let completed = false;
    for await (const event of context.engine.stream(engineRequest(request, context), signal)) {
        if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED) {
            completed = true;
            onCompleted(event);
        }

        yield event;
    }

    if (!completed && !signal.aborted)
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, "The editorial operation ended before completing. Retry the request.");
}


export class EditorialService {
    constructor(
        private readonly articles: EditorialArticleStore,
        private readonly sessions: EditorialSessionStore,
        private readonly styleCorpus: EditorialStyleCorpusStore,
        private readonly artifacts: EditorialArtifactsStore,
        private readonly engines: EditorialEngineResolver,
        private readonly sessionContinuationEnabled: boolean,
    ) { }


    async *stream(request: EditorialServiceRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const context = prepareEditorialStream(this.articles, this.sessions, this.styleCorpus, this.engines, this.sessionContinuationEnabled, request);

        try {
            yield* streamEditorialOperation(
                request,
                context,
                signal,
                (event) => persistCompletedEditorialOutput(this.sessions, this.artifacts, request, context, this.sessionContinuationEnabled, event),
            );
        } catch (error) {
            if (error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED)
                this.sessions.remove(request.articleId);

            throw error;
        }
    }
}
