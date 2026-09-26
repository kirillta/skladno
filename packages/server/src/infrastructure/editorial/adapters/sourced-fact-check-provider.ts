import { randomUUID } from "node:crypto";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";
import { createAiSdkGenerationOptions, isAcceptedFinish } from "./ai-sdk-provider.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import type { FactCheckResearch } from "../models/fact-check-research.js";
import { claimSchema, findingSchema } from "../models/fact-check-schemas.js";


export function createSourcedFactCheckProvider(model: LanguageModel, research: FactCheckProvider["researchClaims"]): FactCheckProvider {
    return {
        researchStage: "web_research",
        async extractClaims(article, instructions, signal) {
            const result = await generateText({
                ...createAiSdkGenerationOptions({ model, signal }),
                system: instructions,
                prompt: `Phase: claim extraction\n\nArticle:\n${article}`,
                output: Output.object({ schema: z.object({ claims: z.array(claimSchema).max(12) }) }),
            });
            if (!result.output || !isAcceptedFinish(result.finishReason))
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

            return { responseId: randomUUID(), claims: result.output.claims };
        },
        researchClaims: research,
        async evaluateClaims(findings: FactCheckResearch[], instructions, signal) {
            const result = await generateText({
                ...createAiSdkGenerationOptions({ model, signal }),
                system: instructions,
                prompt: `Phase: evidence evaluation. Cite only URLs present in the research evidence. If evidence is insufficient, classify as unverifiable.\n\nResearch evidence:\n${JSON.stringify(findings)}`,
                output: Output.object({ schema: z.object({ findings: z.array(findingSchema) }) }),
            });
            if (!result.output || !isAcceptedFinish(result.finishReason))
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

            return { responseId: randomUUID(), findings: result.output.findings };
        },
    };
}
