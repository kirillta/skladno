import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";
import { createAiSdkGenerationOptions, isAcceptedFinish } from "./ai-sdk-provider.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";


/** A match is reused only when the model confirms every material qualifier remains unchanged. */
export function createFactClaimMatcher(model: LanguageModel): NonNullable<FactCheckProvider["matchClaims"]> {
    return async (claims, candidates, signal) => {
        const result = await generateText({
            ...createAiSdkGenerationOptions({ model, signal }),
            system: "Compare factual claims for identity after editing. Match only when they assert the same fact with the same entities, quantities, dates, scope, certainty, and negation. Wording and sentence structure may change. Omit uncertain or materially changed claims. Each candidate may match at most once. Do not research or infer truth.",
            prompt: JSON.stringify({ claims: claims.map((claim, claimIndex) => ({ claimIndex, claim })), candidates }),
            output: Output.object({ schema: z.object({ matches: z.array(z.object({ claimIndex: z.number().int().nonnegative(), factId: z.string() })) }) }),
        });
        if (!result.output || !isAcceptedFinish(result.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const ids = new Set(candidates.map(({ factId }) => factId));
        return result.output.matches.filter(({ claimIndex, factId }) => claimIndex < claims.length && ids.has(factId));
    };
}
