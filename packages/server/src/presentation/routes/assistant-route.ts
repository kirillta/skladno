import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, BUILT_IN_SKILL, builtInSkillScopeCompatibility, HTTP_METHOD, HTTP_STATUS, isBuiltInSkillId, type AssistantEditorialResult, type AssistantEvent, type AssistantRequestScope, type AssistantResponseKind, type BuiltInSkillId, type EditorialOperation } from "@skladno/shared";

import { EDITORIAL_ENGINE_EVENT } from "../../application/ports/editorial-engine-events.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../../application/ports/editorial-engine-event.js";
import { Repositories } from "../../infrastructure/persistence/index.js";
import { ApplicationServiceError } from "../errors/application-error.js";
import { object, readJson, string, writeJson } from "../transport/json.js";

type ResolveEngine = (operation: EditorialOperation, skillId?: BuiltInSkillId) => EditorialEngine | undefined;

interface AssistantRequestInput {
    requestId: string;
    authorMessage: string;
    scope: AssistantRequestScope;
    explicitSkillId?: BuiltInSkillId;
    skillOffset?: number;
    targetLanguage?: string;
    retryOfRequestId?: string;
}

interface PreparedAssistantRequest extends AssistantRequestInput {
    articleId: string;
    articleContent: string;
    resolvedSkillId?: BuiltInSkillId;
    operation: EditorialOperation;
    engine: EditorialEngine;
}


function writeEvent(response: ServerResponse, event: AssistantEvent): void {
    response.write(`event: assistant\ndata: ${JSON.stringify(event)}\n\n`);
}


function scope(value: unknown): AssistantRequestScope {
    const candidate = object(value);
    const baseRevisionId = string(candidate.baseRevisionId, "scope.baseRevisionId");
    if (candidate.kind === "article")
        return { kind: "article", baseRevisionId };

    if (candidate.kind !== "selection" || !Number.isInteger(candidate.startOffset) || !Number.isInteger(candidate.endOffset) || Number(candidate.startOffset) < 0 || Number(candidate.endOffset) <= Number(candidate.startOffset))
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);

    return { kind: "selection", baseRevisionId, startOffset: Number(candidate.startOffset), endOffset: Number(candidate.endOffset) };
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


function readAssistantRequest(body: Record<string, unknown>): AssistantRequestInput {
    const explicitSkillValue = body.explicitSkillId === undefined ? undefined : string(body.explicitSkillId, "explicitSkillId");
    if (explicitSkillValue && !isBuiltInSkillId(explicitSkillValue))
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_UNSUPPORTED, HTTP_STATUS.BAD_REQUEST);

    const targetLanguage = body.targetLanguage === undefined ? undefined : string(body.targetLanguage, "targetLanguage");
    const retryOfRequestId = body.retryOfRequestId === undefined ? undefined : string(body.retryOfRequestId, "retryOfRequestId");
    const skillOffset = body.skillOffset === undefined ? undefined : Number(body.skillOffset);
    if (skillOffset !== undefined && (!explicitSkillValue || !Number.isInteger(skillOffset) || skillOffset < 0 || skillOffset > String(body.authorMessage ?? "").length))
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_UNSUPPORTED, HTTP_STATUS.BAD_REQUEST);

    return {
        requestId: string(body.requestId, "requestId"),
        authorMessage: string(body.authorMessage, "authorMessage"),
        scope: scope(body.scope),
        ...(explicitSkillValue ? { explicitSkillId: explicitSkillValue as BuiltInSkillId } : {}),
        ...(skillOffset === undefined ? {} : { skillOffset }),
        ...(targetLanguage ? { targetLanguage } : {}),
        ...(retryOfRequestId ? { retryOfRequestId } : {}),
    };
}


function prepareAssistantRequest(articleId: string, input: AssistantRequestInput, repositories: Repositories, resolveEngine: ResolveEngine): PreparedAssistantRequest {
    const article = repositories.getArticle(articleId);
    if (!article)
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    if (article.currentRevisionId !== input.scope.baseRevisionId)
        throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

    if (input.explicitSkillId && !builtInSkillScopeCompatibility[input.explicitSkillId].includes(input.scope.kind))
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_SCOPE_INCOMPATIBLE, HTTP_STATUS.BAD_REQUEST);

    if (input.retryOfRequestId && !repositories.assistant.getRequest(input.retryOfRequestId))
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_RETRY_INVALID, HTTP_STATUS.BAD_REQUEST);

    const articleContent = article.currentRevision.content;
    if (input.scope.kind === "selection" && input.scope.endOffset > articleContent.length)
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);

    const resolvedSkillId = input.explicitSkillId ?? inferSkill(input.authorMessage, input.scope);
    if (resolvedSkillId === BUILT_IN_SKILL.TRANSLATION && !input.targetLanguage?.trim())
        throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    if (resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW && !repositories.getStyleCorpus().profile)
        throw new ApplicationServiceError(APPLICATION_ERROR.STYLE_CORPUS_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    const operation = operationFor(resolvedSkillId ?? BUILT_IN_SKILL.FLOW_AND_CLARITY);
    const engine = resolveEngine(operation, resolvedSkillId);
    if (!engine)
        throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

    return { ...input, articleId, articleContent, resolvedSkillId, operation, engine };
}


function persistAcceptedRequest(request: PreparedAssistantRequest, repositories: Repositories): void {
    repositories.assistant.createRequest({ id: request.requestId, articleId: request.articleId, scope: request.scope, explicitSkillId: request.explicitSkillId, skillOffset: request.skillOffset, retryOfRequestId: request.retryOfRequestId });
    repositories.assistant.setAuthorMessage(request.requestId, request.authorMessage);
    repositories.assistant.resolveRequest(request.requestId, request.resolvedSkillId, request.explicitSkillId ? "explicit" : request.resolvedSkillId ? "inferred" : undefined);
}


function articleExcerpt(request: PreparedAssistantRequest): string {
    return request.scope.kind === "selection"
        ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
        : request.articleContent;
}


function startResponseStream(response: ServerResponse, request: PreparedAssistantRequest): AbortController {
    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });
    writeEvent(response, { type: "accepted", requestId: request.requestId });
    writeEvent(response, { type: "skill_resolved", requestId: request.requestId, ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId, source: request.explicitSkillId ? "explicit" : "inferred" } : {}) });

    return new AbortController();
}


function assistantStream(request: PreparedAssistantRequest, repositories: Repositories, controller: AbortController) {
    const excerpt = articleExcerpt(request);
    if (request.resolvedSkillId)
        return request.engine.stream({ operation: request.operation, article: excerpt, authorContext: request.authorMessage, ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}), ...(request.resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW ? { styleProfile: repositories.getStyleCorpus().profile } : {}) }, controller.signal);

    const history = repositories.listAssistantMessages(request.articleId)
        .flatMap((message) => message.role === "author" || (message.role === "assistant" && message.kind === "response") ? message.content ? [{ role: message.role, content: message.content }] : [] : []);

    return request.engine.streamConversation({ message: request.authorMessage, article: excerpt, scope: request.scope.kind, history }, controller.signal);
}


function completedContent(request: PreparedAssistantRequest, text: string): string {
    if (request.scope.kind !== "selection" || !request.resolvedSkillId || request.resolvedSkillId === BUILT_IN_SKILL.FACT_CHECKING)
        return text;

    return `${request.articleContent.slice(0, request.scope.startOffset)}${text}${request.articleContent.slice(request.scope.endOffset)}`;
}


function persistCompletion(request: PreparedAssistantRequest, event: Extract<EditorialEngineEvent, { type: "completed" }>, repositories: Repositories): { messageId: string; artifactId?: string; responseKind: AssistantResponseKind; result?: AssistantEditorialResult } {
    const content = completedContent(request, event.text);
    const kind = responseKind(request.resolvedSkillId);
    const artifactId = request.resolvedSkillId
        ? repositories.createEditorialArtifact({ articleId: request.articleId, revisionId: request.scope.baseRevisionId, kind: request.resolvedSkillId === BUILT_IN_SKILL.FACT_CHECKING ? "fact-check" : "assistant-proposal", content: JSON.stringify({ requestId: request.requestId, resolvedSkillId: request.resolvedSkillId, skillSource: request.explicitSkillId ? "explicit" : "inferred", authorGuidance: request.authorMessage, scope: request.scope, responseId: event.responseId, proposal: content, findings: event.factCheck ?? event.styleReview, translation: event.translation }) }).id
        : undefined;
    const message = repositories.assistant.completeRequest({ requestId: request.requestId, articleId: request.articleId, skillId: request.resolvedSkillId, responseKind: kind, content: request.resolvedSkillId ? "" : content, editorialArtifactId: artifactId });

    const result: AssistantEditorialResult | undefined = request.resolvedSkillId
        ? {
            ...(request.resolvedSkillId === BUILT_IN_SKILL.FACT_CHECKING && event.factCheck ? { factCheck: event.factCheck } : {}),
            ...(request.resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW ? { proposal: content, ...(event.styleReview ? { styleReview: event.styleReview } : {}) } : {}),
            ...(request.resolvedSkillId === BUILT_IN_SKILL.TRANSLATION && event.translation ? { translation: { metadata: event.translation, content } } : {}),
            ...(request.resolvedSkillId === BUILT_IN_SKILL.TALKING_POINTS || request.resolvedSkillId === BUILT_IN_SKILL.NARRATIVE_DRAFT || request.resolvedSkillId === BUILT_IN_SKILL.FLOW_AND_CLARITY ? { proposal: content } : {}),
        }
        : undefined;

    return { messageId: message.id, ...(artifactId ? { artifactId } : {}), responseKind: kind, ...(result ? { result } : {}) };
}


async function streamAssistantRequest(request: PreparedAssistantRequest, incomingRequest: IncomingMessage, response: ServerResponse, repositories: Repositories): Promise<void> {
    persistAcceptedRequest(request, repositories);
    const controller = startResponseStream(response, request);
    incomingRequest.once("aborted", () => controller.abort());
    response.once("close", () => controller.abort());
    let completed = false;
    try {
        for await (const event of assistantStream(request, repositories, controller)) {
            if (event.type === EDITORIAL_ENGINE_EVENT.TEXT_DELTA) {
                writeEvent(response, { type: "text_delta", requestId: request.requestId, delta: event.delta });
            } else if (event.type === EDITORIAL_ENGINE_EVENT.TOOL_STATUS) {
                writeEvent(response, { type: "tool_status", requestId: request.requestId, tool: event.tool, status: event.status });
            } else {
                completed = true;
                const completion = persistCompletion(request, event, repositories);
                writeEvent(response, { type: "completed", requestId: request.requestId, responseKind: completion.responseKind, messageId: completion.messageId, ...(completion.artifactId ? { editorialArtifactId: completion.artifactId } : {}), ...(completion.result ? { result: completion.result } : {}) });
            }
        }

        if (!completed && !controller.signal.aborted) {
            repositories.assistant.failRequest(request.requestId, "failed", APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE);
            writeEvent(response, { type: "error", requestId: request.requestId, errorCode: APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE, retryable: true });
        }
    } catch (error) {
        if (!controller.signal.aborted) {
            const code = error instanceof EditorialEngineError && error.code === "incomplete_stream" ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
            repositories.assistant.failRequest(request.requestId, "failed", code);
            writeEvent(response, { type: "error", requestId: request.requestId, errorCode: code, retryable: true });
        }
    }

    if (controller.signal.aborted)
        repositories.assistant.failRequest(request.requestId, "cancelled", "request_cancelled");

    response.end();
}


export async function handleAssistantRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories, resolveEngine: ResolveEngine): Promise<boolean> {
    const messagesMatch = /^\/api\/articles\/([^/]+)\/assistant\/messages$/.exec(pathname);
    if (messagesMatch && request.method === HTTP_METHOD.GET) {
        const articleId = decodeURIComponent(messagesMatch[1]);
        if (!repositories.getArticle(articleId))
            throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        writeJson(response, HTTP_STATUS.OK, repositories.listAssistantMessages(articleId));
        return true;
    }

    const requestsMatch = /^\/api\/articles\/([^/]+)\/assistant\/requests$/.exec(pathname);
    if (!requestsMatch || request.method !== HTTP_METHOD.POST)
        return false;

    const input = readAssistantRequest(object(await readJson(request)));
    const prepared = prepareAssistantRequest(decodeURIComponent(requestsMatch[1]), input, repositories, resolveEngine);
    await streamAssistantRequest(prepared, request, response, repositories);

    return true;
}
