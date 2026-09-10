import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { ProposalChange, ProposalChangeSummary } from "@skladno/shared";

import type { ProposalSummaryGenerator } from "../../application/ports/proposal-summary-generator.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import { aiSdkGenerationOptions, isAcceptedFinish, type SupportingTextProviderOptions } from "./ai-sdk-provider.js";


const summariesSchema = z.object({
    summaries: z.array(z.object({
        changeId: z.string().min(1),
        summary: z.string().min(1).max(240),
    })),
});


/** Provider-neutral AI SDK implementation of the proposal-summary port. */
export class AiSdkProposalSummaryGeneratorAdapter implements ProposalSummaryGenerator {
    constructor(private readonly model: LanguageModel, private readonly providerOptions: SupportingTextProviderOptions = undefined) { }


    async summarize(changes: ProposalChange[], interfaceLocale: string, signal: AbortSignal): Promise<ProposalChangeSummary[]> {
        if (changes.length === 0)
            return [];

        const result = await generateText({
            ...aiSdkGenerationOptions({ model: this.model, signal, providerOptions: this.providerOptions }),
            prompt: `Summarize each proposed editorial change in one short, neutral sentence for the Author reviewing it. Write every summary in the interface locale ${interfaceLocale}, regardless of the Article language. Describe only what changed and why it helps when that is evident. Do not endorse the change, invent facts, or repeat the full text. Preserve each changeId exactly.\n\n${JSON.stringify(changes.map((change) => ({ changeId: change.id, original: change.baseLines.join("\n").slice(0, 6000), proposed: change.proposalLines.join("\n").slice(0, 6000) })))}`,
            output: Output.object({ schema: summariesSchema }),
        });

        if (!isAcceptedFinish(result.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const requestedIds = new Set(changes.map((change) => change.id));

        return (result.output?.summaries ?? []).filter((summary) => requestedIds.has(summary.changeId));
    }
}
