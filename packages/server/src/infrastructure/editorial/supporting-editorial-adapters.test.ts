import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";

import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { AiSdkProposalSummaryGeneratorAdapter } from "./ai-sdk-proposal-summary-generator-adaptor.js";
import { AiSdkArticleTitleGeneratorAdapter } from "./article-title-generator.js";


function generated(text: string, finishReason: LanguageModelV3GenerateResult["finishReason"]) {
    return {
        content: [{ type: "text" as const, text }],
        finishReason,
        usage: {
            inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
    } satisfies LanguageModelV3GenerateResult;
}


test("title generation rejects output stopped by the token limit", async () => {
    const model = new MockLanguageModelV3({ doGenerate: generated("Partial title", { unified: "length", raw: undefined }) });
    const adapter = new AiSdkArticleTitleGeneratorAdapter(model);

    await assert.rejects(adapter.generate("Article", new AbortController().signal), { code: EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT });
});


test("Proposal summaries reject structured output stopped by the token limit", async () => {
    const model = new MockLanguageModelV3({ doGenerate: generated('{"summaries":[{"changeId":"change-1","summary":"A summary"}]}', { unified: "length", raw: undefined }) });
    const adapter = new AiSdkProposalSummaryGeneratorAdapter(model);

    await assert.rejects(adapter.summarize([{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Before"], proposalLines: ["After"] }], "en", new AbortController().signal), { code: EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT });
});
