import { BUILT_IN_SKILL, EDITORIAL_OPERATION, isBuiltInSkillId } from "@skladno/shared";

import { getReusableFactFindings } from "../editorial/fact-checking/reusable-fact-findings.js";
import type { StyleCorpusStore } from "../editorial/style/style-corpus-store.js";
import type { EditorialEngineEvent } from "../editorial/engine/editorial-engine-event.js";
import { EDITORIAL_ENGINE_ERROR } from "../editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../editorial/engine/editorial-engine-error.js";
import type { FactChecksStore } from "./fact-checks-store.js";
import type { AssistantStore } from "./assistant-store.js";
import { getConversationHistory } from "./requests/conversation-history.js";
import type { PreparedAssistantRequest } from "./requests/prepared-assistant-request.js";


export function streamAssistantEngineEvents(request: PreparedAssistantRequest, stores: { assistant: AssistantStore; styleCorpus: StyleCorpusStore; factChecks: FactChecksStore }, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
    const excerpt = getAssistantArticleExcerpt(request);
    if (!request.resolvedSkillId)
        return streamAssistantConversation(request, stores.assistant, excerpt, signal);

    if (!request.operation)
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return request.engine.stream({
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
            ? { styleProfile: stores.styleCorpus.getStyleCorpus().profile, articleStyleRules: stores.styleCorpus.getArticleStyleRules(request.articleId) }
            : {}
        ),
        ...(request.operation === EDITORIAL_OPERATION.FACT_CHECK ? { reusableFactFindings: getReusableFactFindings(stores.factChecks, request.articleId) } : {})
    }, signal);
}


function getAssistantArticleExcerpt(request: PreparedAssistantRequest): string {
    return request.scope.kind === "selection"
        ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
        : request.articleContent;
}


function streamAssistantConversation(request: PreparedAssistantRequest, assistant: AssistantStore, excerpt: string, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
    return request.engine.streamConversation({
        message: request.authorMessage,
        article: excerpt,
        scope: request.scope.kind,
        history: getConversationHistory(assistant, request.articleId)
    }, signal);
}
