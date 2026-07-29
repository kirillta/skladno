import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { FACT_CHECK_STATUS, type FactCheck, type FactCheckFinding } from "@skladno/shared";

import { EDITORIAL_ENGINE_EVENT, EditorialEngineError, type EditorialEngineEvent } from "./editorial-engine.js";


const claimSchema = z.object({
    claim: z.string().min(1),
});


const sourceSchema = z.object({
    url: z.url(),
    title: z.string().min(1),
    excerpt: z.string().min(1).optional(),
    quality: z.enum(["primary", "credible", "secondary", "unknown"]),
    publishedAt: z.string().optional(),
});


const findingSchema = z.object({
    claim: z.string().min(1),
    status: z.enum([FACT_CHECK_STATUS.SUPPORTED, FACT_CHECK_STATUS.DISPUTED, FACT_CHECK_STATUS.UNVERIFIABLE]),
    rationale: z.string().min(1),
    uncertainty: z.string().min(1),
    sources: z.array(sourceSchema).max(5),
});


const graphStateSchema = z.object({
    article: z.string(),
    claims: z.array(claimSchema).default([]),
    research: z.array(z.object({ claim: z.string(), evidence: z.string() })).default([]),
    findings: z.array(findingSchema).default([]),
});


type FactCheckGraphState = z.infer<typeof graphStateSchema>;


interface LangGraphFactCheckOptions {
    apiKey: string;
    model: string;
    storeResponses: boolean;
}


function boundedArticleContext(article: string): string {
    const maximumCharacters = 24_000;
    if (article.length <= maximumCharacters)
        return article;

    return `${article.slice(0, 12_000)}\n\n[Middle omitted for bounded fact-check context.]\n\n${article.slice(-12_000)}`;
}


function providerError(error: unknown): EditorialEngineError {
    const message = error instanceof Error ? error.message : "OpenAI could not complete the fact check. Retry it in a moment.";
    if (/abort/i.test(message))
        throw error;

    if (/network|fetch|connect|timeout|ECONN|ENOTFOUND/i.test(message))
        return new EditorialEngineError("network", "OpenAI could not be reached. Check your connection and API settings, then retry.");

    return new EditorialEngineError("provider", message);
}


/** A bounded, fixed-stage graph. It has no agent loop and no checkpoint persistence. */
export class LangGraphFactCheck {
    private readonly model: ChatOpenAI;


    constructor(options: LangGraphFactCheckOptions) {
        this.model = new ChatOpenAI({
            apiKey: options.apiKey,
            model: options.model,
            useResponsesApi: true,
            zdrEnabled: !options.storeResponses,
        });
    }


    async *stream(article: string, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const stages = ["claim_extraction", "openai_web_research", "evidence_evaluation", "classification", "citation_assembly"];
        for (const tool of stages)
            yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "started" };

        try {
            const result = await this.createGraph(signal).invoke({ article: boundedArticleContext(article) });
            const factCheck: FactCheck = {
                findings: result.findings.map((finding: FactCheckFinding) => ({
                    ...finding,
                    sources: finding.sources.filter((source) => /^https:\/\//.test(source.url)),
                })),
            };

            for (const tool of stages)
                yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "completed" };

            yield {
                type: EDITORIAL_ENGINE_EVENT.COMPLETED,
                responseId: "fact-check-complete",
                text: "",
                factCheck,
            };
        } catch (error) {
            if (signal.aborted)
                return;

            if (error instanceof EditorialEngineError)
                throw error;

            throw providerError(error);
        }
    }


    private createGraph(signal: AbortSignal) {
        const extraction = this.model.withStructuredOutput(z.object({ claims: z.array(claimSchema).max(12) }), { name: "fact_claim_extraction", strict: true });
        const evaluator = this.model.withStructuredOutput(z.object({ findings: z.array(findingSchema) }), { name: "fact_evidence_evaluation", strict: true });
        const webResearch = this.model.bindTools([{ type: "web_search" }]);

        return new StateGraph({ stateSchema: graphStateSchema })
            .addNode("claim_extraction", async (state: FactCheckGraphState) => {
                const output = await extraction.invoke(`Extract up to 12 externally verifiable factual claims from this article. Exclude opinions and advice.\n\n${state.article}`, { signal });
                return { claims: output.claims };
            })
            .addNode("openai_web_research", async (state: FactCheckGraphState) => {
                const research = await Promise.all(state.claims.map(async ({ claim }) => {
                    const response = await webResearch.invoke(`Research this factual claim using OpenAI web search. Prefer primary sources, report source URLs, publication dates when available, and brief supporting or contradicting evidence. Do not infer missing evidence.\n\nClaim: ${claim}`, { signal });
                    return { claim, evidence: String(response.content) };
                }));

                return { research };
            })
            .addNode("evidence_evaluation", async (state: FactCheckGraphState) => {
                const output = await evaluator.invoke(`Evaluate each article claim using the web-research evidence below. A missing source must be classified as unverifiable. Return only sources actually present in the evidence, with an explicit source-quality rating and uncertainty.\n\n${JSON.stringify(state.research)}`, { signal });
                return { findings: output.findings };
            })
            .addNode("classification", (state: FactCheckGraphState) => ({ findings: state.findings }))
            .addNode("citation_assembly", (state: FactCheckGraphState) => ({ findings: state.findings }))
            .addEdge("__start__", "claim_extraction")
            .addEdge("claim_extraction", "openai_web_research")
            .addEdge("openai_web_research", "evidence_evaluation")
            .addEdge("evidence_evaluation", "classification")
            .addEdge("classification", "citation_assembly")
            .addEdge("citation_assembly", "__end__")
            .compile();
    }
}
