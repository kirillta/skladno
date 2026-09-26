import { generateText, Output } from "ai";
import type { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";
import { createAiSdkGenerationOptions, isAcceptedFinish } from "./ai-sdk-provider.js";
import { getOpenAiResponseId, getOpenAiResponsesProviderOptions } from "./openai-responses.js";
import type { FactCheckResearch } from "../models/fact-check-research.js";
import type { FactCheckFindingDraft } from "../models/fact-check-finding-draft.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import { claimSchema, findingSchema } from "../models/fact-check-schemas.js";


interface OpenAIFactCheckProviderOptions {
    client: ReturnType<typeof createOpenAI>;
    model: string;
    providerOptions: (previousResponseId?: string) => ReturnType<typeof getOpenAiResponsesProviderOptions>;
}


export function createOpenAIFactCheckProvider({ client, model, providerOptions }: OpenAIFactCheckProviderOptions): FactCheckProvider {
    return {
        researchStage: "openai_web_research",
        extractClaims: (article, instructions, signal) => extractClaims(article, instructions, signal, client, model, providerOptions),
        researchClaims: (claims, instructions, signal) => researchClaims(claims, instructions, signal, client, model, providerOptions),
        evaluateClaims: (research, instructions, signal) => evaluateClaims(research, instructions, signal, client, model, providerOptions),
    };
}


async function extractClaims(article: string, instructions: string, signal: AbortSignal, client: OpenAIFactCheckProviderOptions["client"], model: string, providerOptions: OpenAIFactCheckProviderOptions["providerOptions"]): Promise<{ responseId: string; claims: { claim: string }[] }> {
    const result = await generateText({
        ...createAiSdkGenerationOptions({ model: client.responses(model), signal, providerOptions: providerOptions() }),
        system: instructions,
        prompt: `Phase: claim extraction\n\nArticle:\n${article}`,
        output: Output.object({ schema: z.object({ claims: z.array(claimSchema).max(12) }) }),
    });
    const completedResponseId = getOpenAiResponseId(result.providerMetadata);
    if (!result.output || !completedResponseId || !isAcceptedFinish(result.finishReason))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return { responseId: completedResponseId, claims: result.output.claims };
}


async function researchClaims(claims: { claim: string }[], instructions: string, signal: AbortSignal, client: OpenAIFactCheckProviderOptions["client"], model: string, providerOptions: OpenAIFactCheckProviderOptions["providerOptions"]): Promise<FactCheckResearch[]> {
    const research: FactCheckResearch[] = [];
    for (const { claim } of claims) {
        const result = await generateText({
            ...createAiSdkGenerationOptions({ model: client.responses(model), signal, providerOptions: providerOptions() }),
            system: instructions,
            prompt: `Phase: web research\n\nClaim:\n${claim}`,
            tools: { web_search: client.tools.webSearch({ externalWebAccess: true, searchContextSize: "high" }) },
            toolChoice: { type: "tool", toolName: "web_search" },
        });

        research.push({ claim, evidence: result.text, sources: result.sources });
    }

    return research;
}


async function evaluateClaims(research: FactCheckResearch[], instructions: string, signal: AbortSignal, client: OpenAIFactCheckProviderOptions["client"], model: string, providerOptions: OpenAIFactCheckProviderOptions["providerOptions"]): Promise<{ responseId: string; findings: FactCheckFindingDraft[] }> {
    const result = await generateText({
        ...createAiSdkGenerationOptions({ model: client.responses(model), signal, providerOptions: providerOptions() }),
        system: instructions,
        prompt: `Phase: evidence evaluation\n\nResearch evidence:\n${JSON.stringify(research)}`,
        output: Output.object({ schema: z.object({ findings: z.array(findingSchema) }) }),
    });
    const completedResponseId = getOpenAiResponseId(result.providerMetadata);
    if (!result.output || !completedResponseId || !isAcceptedFinish(result.finishReason))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return { responseId: completedResponseId, findings: result.output.findings };
}
