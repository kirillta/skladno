import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { ProposalChange, ProposalChangeSummary } from "@skladno/shared";

import type { ProposalSummaryGenerator } from "../../application/ports/proposal-summary-generator.js";


const summariesSchema = z.object({
    summaries: z.array(z.object({
        changeId: z.string().min(1),
        summary: z.string().min(1).max(240),
    })),
});


export class AiSdkProposalSummaryGenerator implements ProposalSummaryGenerator {
    private readonly openai;


    constructor(apiKey: string, private readonly model: string) {
        this.openai = createOpenAI({ apiKey });
    }


    async summarize(changes: ProposalChange[], signal: AbortSignal): Promise<ProposalChangeSummary[]> {
        if (changes.length === 0)
            return [];

        const result = await generateText({
            model: this.openai.responses(this.model),
            prompt: `Summarize each proposed editorial change in one short, neutral sentence for the Author reviewing it. Describe only what changed and why it helps when that is evident. Do not endorse the change, invent facts, or repeat the full text. Preserve each changeId exactly.\n\n${JSON.stringify(changes.map((change) => ({ changeId: change.id, original: change.baseLines.join("\n").slice(0, 6000), proposed: change.proposalLines.join("\n").slice(0, 6000) })))}`,
            output: Output.object({ schema: summariesSchema }),
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: { openai: { store: false } },
        });
        const requestedIds = new Set(changes.map((change) => change.id));

        return (result.output?.summaries ?? []).filter((summary) => requestedIds.has(summary.changeId));
    }
}
