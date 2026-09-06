import { generateText, isStepCount, Output, streamText, ToolLoopAgent, type LanguageModel, type ModelMessage, type ToolSet } from "ai";
import { randomUUID } from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { AI_PROVIDER, EDITORIAL_OPERATION, type AiProvider } from "@skladno/shared";

import type { EditorialConversationRequest } from "../../application/ports/editorial-conversation-request.js";
import type { EditorialAssistantRequest } from "../../application/ports/editorial-assistant-request.js";
import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../../application/ports/editorial-engine-event.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../application/ports/editorial-engine-events.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import type { EditorialEngineRequest } from "../../application/ports/editorial-engine-request.js";
import { protectArticleSpans, restoreProtectedSpans } from "../../application/editorial/translation.js";
import { authorControlInstruction, createEditorialMessages } from "../../application/editorial/workflow-prompt.js";
import { streamFactCheck } from "./fact-check-workflow.js";
import { boundedArticleContext, isAcceptedFinish, providerError, responseId, responsesProviderOptions } from "./ai-sdk-editorial-helpers.js";
import { createOpenAiFactCheckProvider } from "./openai-fact-check-provider.js";
import { assistantConversationPrompt, assistantStepOptions, createAssistantTools } from "./ai-sdk-assistant.js";
import { styleReview, styleReviewSchema, translationSchema } from "./ai-sdk-editorial-output.js";

export { responsesPrompt, responsesProviderOptions } from "./ai-sdk-editorial-helpers.js";
export { assistantConversationPrompt, assistantStepOptions } from "./ai-sdk-assistant.js";


interface AiSdkEditorialEngineOptions {
    apiKey: string;
    model: string;
    provider: AiProvider;
    languageModel: LanguageModel;
    continuationScope?: { connectionId: string; provider: AiProvider; model: string };
    storeResponses: boolean;
    sourcedResearch: boolean;
    reasoningEffort?: "low" | "medium" | "high";
}


export class AiSdkEditorialEngine implements EditorialEngine {
    private readonly openai;


    readonly continuationScope;


    constructor(private readonly options: AiSdkEditorialEngineOptions) {
        this.openai = createOpenAI({ apiKey: options.apiKey });
        this.continuationScope = options.continuationScope;
    }


    async *stream(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        try {
            if (request.operation === EDITORIAL_OPERATION.FACT_CHECK) {
                if (!this.options.sourcedResearch)
                    throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

                yield* streamFactCheck({
                    request: { article: boundedArticleContext(request.article), reusableFactFindings: request.reusableFactFindings },
                    signal,
                    provider: createOpenAiFactCheckProvider({
                        openai: this.openai,
                        model: this.options.model,
                        providerOptions: (previousResponseId) => responsesProviderOptions(this.options.storeResponses, previousResponseId, this.options.reasoningEffort),
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


    async *streamAssistant(request: EditorialAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const state = { activeCapabilities: request.initialActiveCapabilities };
        const execute = (capability: string, input: Readonly<Record<string, string>>) => this.executeAssistantCapability(request, signal, state, capability, input);
        const agent = this.createAssistantAgent(request, createAssistantTools(request, execute), state);
        const result = await agent.stream({ prompt: assistantConversationPrompt(request), abortSignal: signal });
        let text = "";
        for await (const delta of result.textStream) {
            text += delta;
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta };
        }

        const steps = await result.steps;
        const finalStep = await result.finalStep;
        if (!text.trim() || signal.aborted || (steps.length >= 6 && finalStep.finishReason === "tool-calls"))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: randomUUID(), ...(this.continuationToken(finalStep.providerMetadata) ? { continuationToken: this.continuationToken(finalStep.providerMetadata) } : {}), text };
    }


    private async executeAssistantCapability(request: EditorialAssistantRequest, signal: AbortSignal, state: { activeCapabilities?: readonly string[] }, capability: string, input: Readonly<Record<string, string>>): Promise<unknown> {
        const candidate = request.tools.find((toolCandidate) => toolCandidate.capability === capability);
        if (!candidate)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const result = await candidate.execute(input, signal);
        if (capability === "find_capabilities" && Array.isArray(result))
            state.activeCapabilities = result.flatMap((item) => item && typeof item === "object" && "capability" in item && typeof item.capability === "string" ? [item.capability] : []);

        return result;
    }


    private createAssistantAgent(request: EditorialAssistantRequest, tools: ToolSet, state: { activeCapabilities?: readonly string[] }) {
        const activeTools = () => state.activeCapabilities ? [...state.activeCapabilities, "load_skill"] : ["find_capabilities", "load_skill"];
        const providerOptions = this.providerOptions();

        return new ToolLoopAgent<never, ToolSet>({
            model: this.options.languageModel,
            instructions: [
                "You are Skladno's editorial assistant. Use only the supplied tools when an editorial result is needed.",
                "Never claim that a tool ran when it did not. Preserve author control. Finish with a concise response after the necessary work.",
                `Available Skills:\n${request.skills.map((skill) => `${skill.id}: ${skill.name}. ${skill.description}`).join("\n")}`,
                ...request.instructions,
            ].join("\n\n"),
            tools,
            activeTools: activeTools(),
            prepareStep: ({ stepNumber }) => assistantStepOptions(stepNumber, state.activeCapabilities),
            stopWhen: isStepCount(6),
            telemetry: { isEnabled: false },
            ...(providerOptions ? { providerOptions } : {}),
        });
    }


    private providerOptions(previousResponseId?: string) {
        return this.options.provider === AI_PROVIDER.OPENAI
            ? responsesProviderOptions(this.options.storeResponses, previousResponseId, this.options.reasoningEffort)
            : undefined;
    }


    private continuationToken(metadata: unknown): string | undefined {
        return this.options.provider === AI_PROVIDER.OPENAI && this.options.storeResponses ? responseId(metadata) : undefined;
    }


    private async *streamProposal(messages: ModelMessage[], signal: AbortSignal, previousResponseId?: string): AsyncIterable<EditorialEngineEvent> {
        const result = streamText({
            model: this.options.languageModel,
            messages,
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

        const continuationToken = this.continuationToken((await result.finalStep).providerMetadata);
        if (!finished || !text.trim())
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: randomUUID(), ...(continuationToken ? { continuationToken } : {}), text };
    }


    private async *streamStyleReview(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        if (!request.styleProfile)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const result = await generateText({
            model: this.options.languageModel,
            messages: createEditorialMessages({
                operation: request.operation,
                article: boundedArticleContext(request.article),
                authorContext: request.authorContext,
                styleProfile: request.styleProfile,
                articleStyleRules: request.articleStyleRules,
            }),
            output: Output.object({ schema: styleReviewSchema }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(request.previousResponseId),
        });
        if (!result.output || !isAcceptedFinish(result.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        yield {
            type: EDITORIAL_ENGINE_EVENT.COMPLETED,
            responseId: randomUUID(),
            ...(this.continuationToken(result.providerMetadata) ? { continuationToken: this.continuationToken(result.providerMetadata) } : {}),
            text: result.output.proposal,
            styleReview: styleReview(result.output, request.styleProfile, request.articleStyleRules),
        };
    }


    private async *streamTranslation(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const targetLanguage = request.targetLanguage?.trim();
        if (!targetLanguage)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const protectedArticle = protectArticleSpans(boundedArticleContext(request.article));
        const protectedTitle = protectArticleSpans(request.articleTitle ?? "");
        const result = await generateText({
            model: this.options.languageModel,
            messages: createEditorialMessages({ operation: request.operation, article: protectedArticle.protectedText, articleTitle: protectedTitle.protectedText, authorContext: request.authorContext, targetLanguage }),
            output: Output.object({ schema: translationSchema }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(),
        });
        if (!result.output || !isAcceptedFinish(result.finishReason) || result.output.targetLanguage.trim() !== targetLanguage)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const text = restoreProtectedSpans(result.output.translation, protectedArticle.protectedSpans);
        const title = restoreProtectedSpans(result.output.title, protectedTitle.protectedSpans);
        if (!text || title === undefined)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: randomUUID(), ...(this.continuationToken(result.providerMetadata) ? { continuationToken: this.continuationToken(result.providerMetadata) } : {}), text, translation: { targetLanguage, protectedSpans: protectedArticle.protectedSpans, title } };
    }
}
