import { generateText, Output, streamText, type ModelMessage } from "ai";
import { createOpenAI, type OpenaiResponsesProviderMetadata } from "@ai-sdk/openai";
import { z } from "zod";
import { EDITORIAL_OPERATION, FACT_CHECK_STATUS, type FactCheck, type FactCheckFinding, type StyleProfile, type StyleReview } from "@skladno/shared";

import type { EditorialConversationRequest } from "../../application/ports/editorial-conversation-request.js";
import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../../application/ports/editorial-engine-event.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../application/ports/editorial-engine-events.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import type { EditorialEngineRequest } from "../../application/ports/editorial-engine-request.js";
import { protectArticleSpans, restoreProtectedSpans } from "../../application/editorial/translation.js";
import { authorControlInstruction, createEditorialMessages } from "../../application/editorial/workflow-prompt.js";


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


const claimSchema = z.object({ claim: z.string().min(1) });


const sourceUrlSchema = z.string().min(1).refine((value) => URL.canParse(value), "Expected a URL");


const findingSchema = z.object({
    claim: z.string().min(1),
    status: z.enum([FACT_CHECK_STATUS.SUPPORTED, FACT_CHECK_STATUS.DISPUTED, FACT_CHECK_STATUS.UNVERIFIABLE]),
    rationale: z.string().min(1),
    uncertainty: z.string().min(1),
    sources: z.array(z.object({
        url: sourceUrlSchema,
        title: z.string().min(1),
        excerpt: z.string().min(1).nullable(),
        quality: z.enum(["primary", "credible", "secondary", "unknown"]),
        publishedAt: z.string().nullable(),
    })).max(5),
});


interface AiSdkEditorialEngineOptions {
    apiKey: string;
    model: string;
    storeResponses: boolean;
}


function boundedArticleContext(content: string): string {
    const maximumCharacters = 24_000;
    if (content.length <= maximumCharacters)
        return content;

    const half = Math.floor(maximumCharacters / 2);

    return `${content.slice(0, half)}\n\n[Middle of article omitted to bound editorial context.]\n\n${content.slice(-half)}`;
}


function responseId(metadata: unknown): string | undefined {
    const openai = (metadata as OpenaiResponsesProviderMetadata | undefined)?.openai;

    return typeof openai?.responseId === "string" ? openai.responseId : undefined;
}


function providerError(error: unknown, hadPreviousResponseId: boolean): EditorialEngineError {
    const message = error instanceof Error ? error.message : "OpenAI could not complete this request. Retry it in a moment.";
    if (hadPreviousResponseId && /previous[_ ]response|response.*not found|not found/i.test(message))
        return new EditorialEngineError(EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED, "The saved editorial session is no longer available. Retry to start a fresh session.");

    if (/network|fetch|connect|timeout|ECONN|ENOTFOUND/i.test(message))
        return new EditorialEngineError(EDITORIAL_ENGINE_ERROR.NETWORK, "OpenAI could not be reached. Check your connection and API settings, then retry.");

    return new EditorialEngineError(EDITORIAL_ENGINE_ERROR.PROVIDER, message);
}


function isAcceptedFinish(reason: string): boolean {
    return reason === "stop" || reason === "tool-calls";
}


export function responsesPrompt(messages: ModelMessage[]) {
    return {
        instructions: messages
            .filter((message) => message.role === "system")
            .map((message) => message.content)
            .join("\n\n"),
        messages: messages.filter((message) => message.role !== "system"),
    };
}


function styleReview(value: z.infer<typeof styleReviewSchema>, profile: StyleProfile, articleRules = ""): StyleReview {
    const availableTraits = new Set([...profile.traits.map((trait) => trait.id), ...profile.rules.split("\n").filter(Boolean).map((_rule, index) => `global-rule-${index + 1}`), ...articleRules.split("\n").filter(Boolean).map((_rule, index) => `article-rule-${index + 1}`)]);
    if (value.findings.some((finding) => finding.traitIds.some((traitId) => !availableTraits.has(traitId))))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "Style review cited a trait that is not in the supplied local profile. Retry the request.");

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
                yield* this.streamFactCheck(request, signal);
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
        const messages: ModelMessage[] = [{ role: "system", content: `You are Skladno's editorial assistant. Answer conversationally and help the author decide what to do next. ${authorControlInstruction} Do not turn the Article into a proposal unless the author explicitly asks for an editorial operation.` }];
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
        return {
            openai: {
                store: this.options.storeResponses,
                ...(this.options.storeResponses && previousResponseId ? { previousResponseId } : {}),
            },
        };
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
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, "OpenAI ended before completing the proposal. Retry the request.");
        }

        const completedResponseId = responseId((await result.finalStep).providerMetadata);
        if (!finished || !text || !completedResponseId)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, "OpenAI ended before completing the proposal. Retry the request.");

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: completedResponseId, text };
    }


    private async *streamStyleReview(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        if (!request.styleProfile)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "Add at least one style corpus item before checking style.");

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
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "OpenAI returned an incomplete style review. Retry the request.");

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
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "Choose a target language before requesting a translation.");

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
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "OpenAI returned incomplete translation metadata. Retry the translation.");

        const text = restoreProtectedSpans(result.output.translation, protectedArticle.protectedSpans);
        if (!text)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "The translation changed protected code, links, or technical names. Review the proposal and retry if you want an alternative.");

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: completedResponseId, text, translation: { targetLanguage, protectedSpans: protectedArticle.protectedSpans } };
    }


    private async *streamFactCheck(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const stages = ["claim_extraction", "openai_web_research", "evidence_evaluation", "classification", "citation_assembly"];
        for (const tool of stages)
            yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "started" };

        const extraction = await generateText({
            model: this.openai.responses(this.options.model),
            prompt: `Extract up to 12 externally verifiable factual claims from this article. Exclude opinions and advice.\n\n${boundedArticleContext(request.article)}`,
            output: Output.object({ schema: z.object({ claims: z.array(claimSchema).max(12) }) }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(),
        });
        const extractionResponseId = responseId(extraction.providerMetadata);
        if (!extraction.output || !extractionResponseId || !isAcceptedFinish(extraction.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "OpenAI returned incomplete fact-check claims. Retry the request.");

        const reusableByClaim = new Map<string, FactCheckFinding>();
        for (const finding of request.reusableFactFindings ?? []) {
            const key = finding.claim.trim().toLowerCase().replace(/\s+/g, " ");
            if (finding.status === FACT_CHECK_STATUS.SUPPORTED && !reusableByClaim.has(key))
                reusableByClaim.set(key, finding);
        }

        const reusedFindings: FactCheckFinding[] = [];
        const claimsToCheck = extraction.output.claims.filter(({ claim }) => {
            const reusable = reusableByClaim.get(claim.trim().toLowerCase().replace(/\s+/g, " "));
            if (!reusable)
                return true;

            reusedFindings.push({ ...reusable, claim });
            return false;
        });

        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "claim_extraction", status: "completed", claims: [
            ...reusedFindings.map(({ claim }) => ({ claim, checked: true })),
            ...claimsToCheck.map(({ claim }) => ({ claim, checked: false })),
        ] };

        const research: { claim: string; evidence: string; sources: unknown }[] = [];
        for (const { claim } of claimsToCheck) {
            const result = await generateText({
                model: this.openai.responses(this.options.model),
                prompt: `Research this factual claim using OpenAI web search. Prefer primary sources, report source URLs, publication dates when available, and brief supporting or contradicting evidence. Do not infer missing evidence.\n\nClaim: ${claim}`,
                tools: { web_search: this.openai.tools.webSearch({ externalWebAccess: true, searchContextSize: "high" }) },
                toolChoice: { type: "tool", toolName: "web_search" },
                abortSignal: signal,
                telemetry: { isEnabled: false },
                providerOptions: this.providerOptions(),
            });

            research.push({ claim, evidence: result.text, sources: result.sources });
        }

        if (!claimsToCheck.length) {
            for (const tool of stages.filter((tool) => tool !== "claim_extraction"))
                yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "completed" };

            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: extractionResponseId, text: "", factCheck: { findings: reusedFindings } };
            return;
        }

        const evaluation = await generateText({
            model: this.openai.responses(this.options.model),
            prompt: `Evaluate each article claim using the web-research evidence below. A missing source must be classified as unverifiable. Return only sources actually present in the evidence, with an explicit source-quality rating and uncertainty.\n\n${JSON.stringify(research)}`,
            output: Output.object({ schema: z.object({ findings: z.array(findingSchema) }) }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: this.providerOptions(),
        });
        const completedResponseId = responseId(evaluation.providerMetadata);
        if (!evaluation.output || !completedResponseId || !isAcceptedFinish(evaluation.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, "OpenAI returned incomplete fact-check findings. Retry the request.");

        const factCheck: FactCheck = {
            findings: [...reusedFindings, ...evaluation.output.findings.map((finding) => ({
                ...finding,
                sources: finding.sources
                    .filter((source) => /^https:\/\//.test(source.url))
                    .map(({ excerpt, publishedAt, ...source }) => ({
                        ...source,
                        ...(excerpt ? { excerpt } : {}),
                        ...(publishedAt ? { publishedAt } : {}),
                    })),
            }))],
        };

        for (const tool of stages.filter((tool) => tool !== "claim_extraction"))
            yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "completed" };

        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: completedResponseId, text: "", factCheck };
    }
}
