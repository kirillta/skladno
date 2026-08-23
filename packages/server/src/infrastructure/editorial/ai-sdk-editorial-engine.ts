import { generateText, Output, streamText, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { EDITORIAL_OPERATION, type StyleProfile, type StyleReview } from "@skladno/shared";

import type { EditorialConversationRequest } from "../../application/ports/editorial-conversation-request.js";
import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../../application/ports/editorial-engine-event.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../application/ports/editorial-engine-events.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import type { EditorialEngineRequest } from "../../application/ports/editorial-engine-request.js";
import { protectArticleSpans, restoreProtectedSpans } from "../../application/editorial/translation.js";
import { authorControlInstruction, createEditorialMessages } from "../../application/editorial/workflow-prompt.js";
import { streamFactCheck } from "./fact-check-workflow.js";
import { boundedArticleContext, isAcceptedFinish, providerError, responseId, responsesPrompt, responsesProviderOptions } from "./ai-sdk-editorial-helpers.js";
import { createOpenAiFactCheckProvider } from "./openai-fact-check-provider.js";

export { responsesPrompt, responsesProviderOptions } from "./ai-sdk-editorial-helpers.js";


const styleReviewSchema = z.object({
    proposal: z.string().min(1),
    findings: z.array(z.object({
        divergence: z.string().min(1),
        suggestion: z.string().min(1),
        traitIds: z.array(z.string().min(1)).min(1),
    })),
});


const translationSchema = z.object({
    translation: z.string().min(1),
    targetLanguage: z.string().min(1),
});


interface AiSdkEditorialEngineOptions {
    apiKey: string;
    model: string;
    storeResponses: boolean;
}


function styleReview(value: z.infer<typeof styleReviewSchema>, profile: StyleProfile, articleRules = ""): StyleReview {
    const availableTraits = new Set([
        ...profile.traits.map((trait) => trait.id),
        ...profile.rules.split("\n").filter(Boolean).map((_rule, index) => `global-rule-${index + 1}`),
        ...articleRules.split("\n").filter(Boolean).map((_rule, index) => `article-rule-${index + 1}`)
    ]);
    if (value.findings.some((finding) => finding.traitIds.some((traitId) => !availableTraits.has(traitId))))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return {
        findings: value.findings,
        profileVersion: profile.version,
        confidence: profile.confidence,
        traitLabels: Object.fromEntries([...profile.traits.map((trait) => [trait.id, trait.label]), ...profile.rules.split("\n").filter(Boolean).map((rule, index) => [`global-rule-${index + 1}`, rule]), ...articleRules.split("\n").filter(Boolean).map((rule, index) => [`article-rule-${index + 1}`, rule])]),
        globalRules: profile.rules.split("\n").filter(Boolean),
        articleRules: articleRules.split("\n").filter(Boolean),
    };
}


export class AiSdkEditorialEngine implements EditorialEngine {
    private readonly openai;


    constructor(private readonly options: AiSdkEditorialEngineOptions) {
        this.openai = createOpenAI({ apiKey: options.apiKey });
    }


    async *stream(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        try {
            if (request.operation === EDITORIAL_OPERATION.FACT_CHECK) {
                yield* streamFactCheck({
                    request: { article: boundedArticleContext(request.article), reusableFactFindings: request.reusableFactFindings },
                    signal,
                    provider: createOpenAiFactCheckProvider({
                        openai: this.openai,
                        model: this.options.model,
                        providerOptions: (previousResponseId) => this.providerOptions(previousResponseId),
                    }),
                });
                return;
            }

            if (request.operation === EDITORIAL_OPERATION.STYLE_REVIEW) {
                yield* this.streamStyleReview(request, signal);
                return;
            }

            if (request.operation === EDITORIAL_OPERATION.TRANSLATION) {
                yield* this.streamTranslation(request, signal);
                return;
            }

            yield* this.streamProposal(createEditorialMessages({
                operation: request.operation,
                article: boundedArticleContext(request.article),
                articleSelection: request.articleSelection,
                authorContext: request.authorContext,
                skillId: request.skillId,
                surroundingArticleCharacterCount: request.surroundingArticleCharacterCount,
                targetArticleCharacterLimit: request.targetArticleCharacterLimit,
            }), signal, request.previousResponseId);
        } catch (error) {
            if (error instanceof EditorialEngineError || signal.aborted)
                throw error;

            throw providerError(error, Boolean(request.previousResponseId));
        }
    }


    async *streamConversation(request: EditorialConversationRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const messages: ModelMessage[] = [{
            role: "system",
            content: `You are Skladno's editorial assistant. Answer conversationally and help the author decide what to do next. ${authorControlInstruction} Do not turn the Article into a proposal unless the author explicitly asks for an editorial operation.`
        }];
        if (request.article)
            messages.push({ role: "system", content: `${request.scope === "selection" ? "Selected Article context" : "Current Article context"}:\n${boundedArticleContext(request.article)}` });

        for (const turn of request.history.slice(-12))
            messages.push({ role: turn.role === "author" ? "user" : "assistant", content: turn.content });

        messages.push({ role: "user", content: request.message });

        try {
            yield* this.streamProposal(messages, signal);
        } catch (error) {
            if (error instanceof EditorialEngineError || signal.aborted)
                throw error;

            throw providerError(error, false);
        }
    }


    private providerOptions(previousResponseId?: string) {
        return responsesProviderOptions(this.options.storeResponses, previousResponseId);
    }


    private async *streamProposal(messages: ModelMessage[], signal: AbortSignal, previousResponseId?: string): AsyncIterable<EditorialEngineEvent> {
        const result = streamText({
            model: this.openai.responses(this.options.model),
            ...responsesPrompt(messages),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(previousResponseId),
        });
        let text = "";
        let finished = false;

        for await (const part of result.stream) {
            if (part.type === "text-delta") {
                text += part.text;
                yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: part.text };
            }

            if (part.type === "error")
                throw providerError(part.error, Boolean(previousResponseId));

            if (part.type === "finish" && isAcceptedFinish(part.finishReason))
                finished = true;

            if (part.type === "abort")
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);
        }

        const completedResponseId = responseId((await result.finalStep).providerMetadata);
        if (!finished || !text || !completedResponseId)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: completedResponseId, text };
    }


    private async *streamStyleReview(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        if (!request.styleProfile)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const result = await generateText({
            model: this.openai.responses(this.options.model),
            ...responsesPrompt(createEditorialMessages({
                operation: request.operation,
                article: boundedArticleContext(request.article),
                authorContext: request.authorContext,
                styleProfile: request.styleProfile,
                articleStyleRules: request.articleStyleRules,
            })),
            output: Output.object({ schema: styleReviewSchema }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(request.previousResponseId),
        });
        const completedResponseId = responseId(result.providerMetadata);
        if (!result.output || !completedResponseId || !isAcceptedFinish(result.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        yield {
            type: EDITORIAL_ENGINE_EVENT.COMPLETED,
            responseId: completedResponseId,
            text: result.output.proposal,
            styleReview: styleReview(result.output, request.styleProfile, request.articleStyleRules),
        };
    }


    private async *streamTranslation(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const targetLanguage = request.targetLanguage?.trim();
        if (!targetLanguage)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const protectedArticle = protectArticleSpans(boundedArticleContext(request.article));
        const result = await generateText({
            model: this.openai.responses(this.options.model),
            ...responsesPrompt(createEditorialMessages({ operation: request.operation, article: protectedArticle.protectedText, authorContext: request.authorContext, targetLanguage })),
            output: Output.object({ schema: translationSchema }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(),
        });
        const completedResponseId = responseId(result.providerMetadata);
        if (!result.output || !completedResponseId || !isAcceptedFinish(result.finishReason) || result.output.targetLanguage.trim() !== targetLanguage)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const text = restoreProtectedSpans(result.output.translation, protectedArticle.protectedSpans);
        if (!text)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: completedResponseId, text, translation: { targetLanguage, protectedSpans: protectedArticle.protectedSpans } };
    }
}
