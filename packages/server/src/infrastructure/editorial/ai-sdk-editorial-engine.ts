import { generateText, isStepCount, Output, streamText, tool, ToolLoopAgent, type ModelMessage, type ToolSet } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { EDITORIAL_OPERATION, type StyleProfile, type StyleReview } from "@skladno/shared";

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
    title: z.string(),
    targetLanguage: z.string().min(1),
});


interface AiSdkEditorialEngineOptions {
    apiKey: string;
    model: string;
    storeResponses: boolean;
    reasoningEffort?: "low" | "medium" | "high";
}


type AssistantToolExecutor = (capability: string, input: Readonly<Record<string, string>>) => Promise<unknown>;
type AssistantTool = EditorialAssistantRequest["tools"][number];


function createAssistantTool(candidate: AssistantTool, execute: AssistantToolExecutor) {
    if (candidate.input === "proposal-operation")
        return tool({ description: candidate.description, inputSchema: z.object({ operation: z.enum(["thesis_to_narrative", "flow_revision"]) }), execute: ({ operation }) => execute(candidate.capability, { operation }) });

    if (candidate.input === "target-language")
        return tool({ description: candidate.description, inputSchema: z.object({ targetLanguage: z.string().min(1) }), execute: ({ targetLanguage }) => execute(candidate.capability, { targetLanguage }) });

    if (candidate.input === "title")
        return tool({ description: candidate.description, inputSchema: z.object({ title: z.string().min(1) }), execute: ({ title }) => execute(candidate.capability, { title }) });

    if (candidate.input === "language")
        return tool({ description: candidate.description, inputSchema: z.object({ language: z.string().min(1) }), execute: ({ language }) => execute(candidate.capability, { language }) });

    if (candidate.input === "publishing-profile")
        return tool({ description: candidate.description, inputSchema: z.object({ profileId: z.string().min(1) }), execute: ({ profileId }) => execute(candidate.capability, { profileId }) });

    if (candidate.input === "style-rules")
        return tool({ description: candidate.description, inputSchema: z.object({ rules: z.string() }), execute: ({ rules }) => execute(candidate.capability, { rules }) });

    if (candidate.input === "artifact-id")
        return tool({ description: candidate.description, inputSchema: z.object({ artifactId: z.string().min(1) }), execute: ({ artifactId }) => execute(candidate.capability, { artifactId }) });

    if (candidate.input === "finding-ids")
        return tool({ description: candidate.description, inputSchema: z.object({ findingIds: z.string().min(1) }), execute: ({ findingIds }) => execute(candidate.capability, { findingIds }) });

    if (candidate.input === "capability-query")
        return tool({ description: candidate.description, inputSchema: z.object({ query: z.string().min(1) }), execute: ({ query }) => execute(candidate.capability, { query }) });

    return tool({ description: candidate.description, inputSchema: z.object({}), execute: () => execute(candidate.capability, {}) });
}


function createAssistantTools(request: EditorialAssistantRequest, execute: AssistantToolExecutor): ToolSet {
    return {
        ...Object.fromEntries(request.tools.map((candidate) => [candidate.capability, createAssistantTool(candidate, execute)])),
        load_skill: tool({
            description: "Load the full instructions for one relevant Skladno Skill.",
            inputSchema: z.object({ id: z.string().min(1) }),
            execute: ({ id }) => request.skills.find((skill) => skill.id === id)?.instructions ?? "Unknown Skill.",
        }),
    };
}


export function assistantStepOptions(stepNumber: number, activeCapabilities?: readonly string[]): { activeTools: string[]; toolChoice?: { type: "tool"; toolName: string } } {
    const activeTools = activeCapabilities ? [...activeCapabilities, "find_capabilities", "load_skill"] : ["find_capabilities", "load_skill"];
    const requiredCapability = activeCapabilities?.[0];

    return stepNumber === 0 && requiredCapability
        ? { activeTools, toolChoice: { type: "tool", toolName: requiredCapability } }
        : { activeTools };
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


    async *streamAssistant(request: EditorialAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const state = { activeCapabilities: request.initialActiveCapabilities };
        const execute = (capability: string, input: Readonly<Record<string, string>>) => this.executeAssistantCapability(request, signal, state, capability, input);
        const agent = this.createAssistantAgent(request, createAssistantTools(request, execute), state);
        const result = await agent.stream({ prompt: this.assistantPrompt(request), abortSignal: signal });
        let text = "";
        for await (const delta of result.textStream) {
            text += delta;
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta };
        }

        const steps = await result.steps;
        const finalStep = await result.finalStep;
        if (!text.trim() || signal.aborted || (steps.length >= 6 && finalStep.finishReason === "tool-calls"))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: responseId(finalStep.providerMetadata) ?? "assistant-tool-loop", text };
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

        return new ToolLoopAgent<never, ToolSet>({
            model: this.openai.responses(this.options.model),
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
            providerOptions: this.providerOptions(),
        });
    }


    private assistantPrompt(request: EditorialAssistantRequest): string {
        return `Recent conversation:\n${request.history.map((turn) => `${turn.role}: ${turn.content}`).join("\n")}\n\nAuthor request:\n${request.message}\n\n${request.scope === "selection" ? "Selected Article context" : "Current Article context"}:\n${boundedArticleContext(request.article)}`;
    }


    private providerOptions(previousResponseId?: string) {
        return responsesProviderOptions(this.options.storeResponses, previousResponseId, this.options.reasoningEffort);
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
        const protectedTitle = protectArticleSpans(request.articleTitle ?? "");
        const result = await generateText({
            model: this.openai.responses(this.options.model),
            ...responsesPrompt(createEditorialMessages({ operation: request.operation, article: protectedArticle.protectedText, articleTitle: protectedTitle.protectedText, authorContext: request.authorContext, targetLanguage })),
            output: Output.object({ schema: translationSchema }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(),
        });
        const completedResponseId = responseId(result.providerMetadata);
        if (!result.output || !completedResponseId || !isAcceptedFinish(result.finishReason) || result.output.targetLanguage.trim() !== targetLanguage)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const text = restoreProtectedSpans(result.output.translation, protectedArticle.protectedSpans);
        const title = restoreProtectedSpans(result.output.title, protectedTitle.protectedSpans);
        if (!text || title === undefined)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: completedResponseId, text, translation: { targetLanguage, protectedSpans: protectedArticle.protectedSpans, title } };
    }
}
