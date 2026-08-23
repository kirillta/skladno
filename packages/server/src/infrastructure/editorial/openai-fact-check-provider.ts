import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { FACT_CHECK_STATUS } from "@skladno/shared";

import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import { isAcceptedFinish, responseId, responsesProviderOptions } from "./ai-sdk-editorial-helpers.js";
import type { FactCheckFindingDraft, FactCheckProvider, FactCheckResearch } from "./fact-check-workflow.js";


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


interface OpenAiFactCheckProviderOptions {
    openai: ReturnType<typeof createOpenAI>;
    model: string;
    providerOptions: (previousResponseId?: string) => ReturnType<typeof responsesProviderOptions>;
}


export function createOpenAiFactCheckProvider({ openai, model, providerOptions }: OpenAiFactCheckProviderOptions): FactCheckProvider {
    return {
        researchStage: "openai_web_research",
        extractClaims: (article, signal) => extractClaims(article, signal, openai, model, providerOptions),
        researchClaims: (claims, signal) => researchClaims(claims, signal, openai, model, providerOptions),
        evaluateClaims: (research, signal) => evaluateClaims(research, signal, openai, model, providerOptions),
    };
}


async function extractClaims(article: string, signal: AbortSignal, openai: OpenAiFactCheckProviderOptions["openai"], model: string, providerOptions: OpenAiFactCheckProviderOptions["providerOptions"]): Promise<{ responseId: string; claims: { claim: string }[] }> {
    const result = await generateText({
        model: openai.responses(model),
        prompt: `Extract up to 12 externally verifiable factual claims from this article. Exclude opinions and advice.\n\n${article}`,
        output: Output.object({ schema: z.object({ claims: z.array(claimSchema).max(12) }) }),
        abortSignal: signal,
        telemetry: { isEnabled: false },
        providerOptions: providerOptions(),
    });
    const completedResponseId = responseId(result.providerMetadata);
    if (!result.output || !completedResponseId || !isAcceptedFinish(result.finishReason))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return { responseId: completedResponseId, claims: result.output.claims };
}


async function researchClaims(claims: { claim: string }[], signal: AbortSignal, openai: OpenAiFactCheckProviderOptions["openai"], model: string, providerOptions: OpenAiFactCheckProviderOptions["providerOptions"]): Promise<FactCheckResearch[]> {
    const research: FactCheckResearch[] = [];
    for (const { claim } of claims) {
        const result = await generateText({
            model: openai.responses(model),
            prompt: `Research this factual claim using web search. Prefer primary sources, report source URLs, publication dates when available, and brief supporting or contradicting evidence. Do not infer missing evidence.\n\nClaim: ${claim}`,
            tools: { web_search: openai.tools.webSearch({ externalWebAccess: true, searchContextSize: "high" }) },
            toolChoice: { type: "tool", toolName: "web_search" },
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: providerOptions(),
        });

        research.push({ claim, evidence: result.text, sources: result.sources });
    }

    return research;
}


async function evaluateClaims(research: FactCheckResearch[], signal: AbortSignal, openai: OpenAiFactCheckProviderOptions["openai"], model: string, providerOptions: OpenAiFactCheckProviderOptions["providerOptions"]): Promise<{ responseId: string; findings: FactCheckFindingDraft[] }> {
    const result = await generateText({
        model: openai.responses(model),
        prompt: `Evaluate each article claim using the web-research evidence below. A missing source must be classified as unverifiable. Return only sources actually present in the evidence, with an explicit source-quality rating and uncertainty.\n\n${JSON.stringify(research)}`,
        output: Output.object({ schema: z.object({ findings: z.array(findingSchema) }) }),
        abortSignal: signal,
        telemetry: { isEnabled: false },
        providerOptions: providerOptions(),
    });
    const completedResponseId = responseId(result.providerMetadata);
    if (!result.output || !completedResponseId || !isAcceptedFinish(result.finishReason))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return { responseId: completedResponseId, findings: result.output.findings };
}
