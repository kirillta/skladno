import {
    APPLICATION_ERROR,
    EDITORIAL_OPERATION,
    HTTP_STATUS,
    type Article,
    type CreateEditorialArtifactInput,
    type EditorialArtifact,
    type EditorialOperation,
    type StyleProfile
} from "@skladno/shared";
import { createHash } from "node:crypto";
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
    articleStyleRules?: string;
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
    get(): { profile?: StyleProfile; status: "empty" | "outdated" | "ready" };
    getArticleRules(articleId: string): string;
}


interface EditorialArtifactsStore {
    create(input: CreateEditorialArtifactInput): EditorialArtifact;
    createWithCitations(input: CreateEditorialArtifactInput, citations: Omit<import("@skladno/shared").CreateSourceCitationInput, "editorialArtifactId">[]): EditorialArtifact;
}


interface FactChecksStore { save(artifactId: string, articleId: string, revisionId: string): void; }


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

    const corpus = request.operation === EDITORIAL_OPERATION.STYLE_REVIEW ? styleCorpus.get() : undefined;
    const styleProfile = corpus?.profile;
    if (request.operation === EDITORIAL_OPERATION.STYLE_REVIEW && (corpus?.status !== "ready" || !styleProfile))
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
        ...(styleProfile ? { articleStyleRules: styleCorpus.getArticleRules(request.articleId) } : {}),
        ...(session?.previousResponseId ? { previousResponseId: session.previousResponseId } : {}),
    };
}


function engineRequest(request: EditorialServiceRequest, context: EditorialStreamContext) {
    return {
        operation: request.operation,
        article: request.articleContent ?? context.article.currentRevision.content,
        ...(request.operation === EDITORIAL_OPERATION.TRANSLATION ? { articleTitle: context.article.title } : {}),
        ...(request.articleSelection ? { articleSelection: true } : {}),
        ...(request.surroundingArticleCharacterCount !== undefined ? { surroundingArticleCharacterCount: request.surroundingArticleCharacterCount } : {}),
        authorContext: request.authorContext,
        ...(context.styleProfile ? { styleProfile: context.styleProfile } : {}),
        ...(context.styleProfile ? { articleStyleRules: context.articleStyleRules } : {}),
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
            articleStyleRules: context.articleStyleRules,
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


function persistCompletedEditorialOutput(sessions: EditorialSessionStore, artifacts: EditorialArtifactsStore, factChecks: FactChecksStore, request: EditorialServiceRequest, context: EditorialStreamContext, sessionContinuationEnabled: boolean, event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>): string {
    if (!context.factCheck && !context.translation && sessionContinuationEnabled)
        sessions.save(request.articleId, event.responseId);

    if (!context.factCheck)
        return artifacts.create(artifactInput(request, context, event)).id;

    const factCheck = event.factCheck!;
    const enriched = { ...event, factCheck: {
        ...factCheck,
        reviewedRevisionId: context.article.currentRevisionId,
        createdAt: new Date().toISOString(),
        findings: factCheck.findings.map((finding) => {
            const factId = createHash("sha256").update(finding.claim.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 16);
            return { ...finding, factId, occurrenceId: `${context.article.currentRevisionId}:${factId}`, checkedAt: new Date().toISOString() };
        }),
    } };

    const artifact = artifacts.createWithCitations(artifactInput(request, context, enriched), citationsFor(enriched));
    factChecks.save(artifact.id, request.articleId, context.article.currentRevisionId);

    return artifact.id;
}


async function* streamEditorialOperation(request: EditorialServiceRequest, context: EditorialStreamContext, signal: AbortSignal, onCompleted: (event: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>) => string | undefined): AsyncIterable<EditorialEngineEvent> {
    let completed = false;
    for await (const event of context.engine.stream(engineRequest(request, context), signal)) {
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
        private readonly articles: EditorialArticleStore,
        private readonly sessions: EditorialSessionStore,
        private readonly styleCorpus: EditorialStyleCorpusStore,
        private readonly artifacts: EditorialArtifactsStore,
        private readonly engines: EditorialEngineResolver,
        private readonly sessionContinuationEnabled: boolean,
        private readonly factChecks: FactChecksStore = { save: () => undefined },
    ) { }


    async *stream(request: EditorialServiceRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const context = prepareEditorialStream(this.articles, this.sessions, this.styleCorpus, this.engines, this.sessionContinuationEnabled, request);

        try {
            yield* streamEditorialOperation(
                request,
                context,
                signal,
                (event) => persistCompletedEditorialOutput(this.sessions, this.artifacts, this.factChecks, request, context, this.sessionContinuationEnabled, event),
            );
        } catch (error) {
            if (error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED)
                this.sessions.remove(request.articleId);

            throw error;
        }
    }


    async *streamStaged(request: EditorialServiceRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const context = prepareEditorialStream(this.articles, this.sessions, this.styleCorpus, this.engines, this.sessionContinuationEnabled, request);

        try {
            yield* streamEditorialOperation(request, context, signal, () => undefined);
        } catch (error) {
            if (error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED)
                this.sessions.remove(request.articleId);

            throw error;
        }
    }
}
