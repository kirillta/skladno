import { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { StyleProfile, StyleReview } from "@skladno/shared";

import { EDITORIAL_OPERATION } from "@skladno/shared";
import { EDITORIAL_ENGINE_EVENT, EditorialEngineError, type EditorialEngine, type EditorialEngineEvent, type EditorialEngineRequest } from "./editorial-engine.js";
import { createEditorialMessages } from "./workflow-prompt.js";


const styleReviewSchema = z.object({
    proposal: z.string().min(1),
    findings: z.array(z.object({
        divergence: z.string().min(1),
        suggestion: z.string().min(1),
        traitIds: z.array(z.string().min(1)).min(1),
    })),
});


interface LangChainEditorialEngineOptions {
    apiKey: string;
    model: string;
    storeResponses: boolean;
}


interface PreparedEditorialRequest {
    messages: BaseMessage[];
    callOptions: {
        signal: AbortSignal;
        previous_response_id?: string;
    };
}


function boundedArticleContext(content: string): string {
    const maximumCharacters = 24_000;
    if (content.length <= maximumCharacters)
        return content;

    const half = Math.floor(maximumCharacters / 2);

    return `${content.slice(0, half)}\n\n[Middle of article omitted to bound editorial context.]\n\n${content.slice(-half)}`;
}


function responseId(value: unknown): string | undefined {
    if (typeof value !== "object" || value === null)
        return undefined;

    const metadata = (value as { response_metadata?: unknown }).response_metadata;
    if (typeof metadata !== "object" || metadata === null)
        return undefined;

    const id = (metadata as { id?: unknown }).id;

    return typeof id === "string" ? id : undefined;
}


function styleReview(value: z.infer<typeof styleReviewSchema>, profile: StyleProfile): StyleReview {
    const availableTraits = new Set(profile.traits.map((trait) => trait.id));
    if (value.findings.some((finding) => finding.traitIds.some((traitId) => !availableTraits.has(traitId))))
        throw new EditorialEngineError("invalid_output", "Style review cited a trait that is not in the supplied local profile. Retry the request.");

    return { findings: value.findings };
}


function providerError(error: unknown, hadPreviousResponseId: boolean): EditorialEngineError {
    const message = error instanceof Error ? error.message : "OpenAI could not complete this request. Retry it in a moment.";
    if (hadPreviousResponseId && /previous[_ ]response|response.*not found|not found/i.test(message))
        return new EditorialEngineError("session_expired", "The saved editorial session is no longer available. Retry to start a fresh session.");

    if (/network|fetch|connect|timeout|ECONN|ENOTFOUND/i.test(message))
        return new EditorialEngineError("network", "OpenAI could not be reached. Check your connection and API settings, then retry.");

    return new EditorialEngineError("provider", message);
}


export class LangChainEditorialEngine implements EditorialEngine {
    private readonly model: ChatOpenAI;


    constructor(private readonly options: LangChainEditorialEngineOptions) {
        this.model = new ChatOpenAI({
            apiKey: options.apiKey,
            model: options.model,
            useResponsesApi: true,
            zdrEnabled: !options.storeResponses,
        });
    }


    async *stream(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        try {
            yield* this.streamOperation(request, signal);
        } catch (error) {
            if (error instanceof EditorialEngineError)
                throw error;

            throw providerError(error, Boolean(request.previousResponseId));
        }
    }


    private async *streamOperation(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const prepared = await this.prepareRequest(request, signal);

        if (request.operation === EDITORIAL_OPERATION.STYLE_REVIEW) {
            yield* this.streamStyleReview(request, prepared);

            return;
        }

        yield* this.streamTextProposal(prepared);
    }


    private async prepareRequest(request: EditorialEngineRequest, signal: AbortSignal): Promise<PreparedEditorialRequest> {
        const messages = await createEditorialMessages({
            operation: request.operation,
            article: boundedArticleContext(request.article),
            authorContext: request.authorContext,
            styleProfile: request.styleProfile,
        });

        return {
            messages,
            callOptions: {
                signal,
                ...(request.previousResponseId ? { previous_response_id: request.previousResponseId } : {}),
            },
        };
    }


    private async *streamStyleReview(request: EditorialEngineRequest, prepared: PreparedEditorialRequest): AsyncIterable<EditorialEngineEvent> {
        if (!request.styleProfile)
            throw new EditorialEngineError("invalid_output", "Add at least one style corpus item before checking style.");

        const structuredModel = this.model.withStructuredOutput(styleReviewSchema, {
            name: "style_review",
            strict: true,
            includeRaw: true,
        });
        const output = await structuredModel.invoke(prepared.messages, prepared.callOptions);
        const parsed = output.parsed;
        const rawResponseId = responseId(output.raw);

        if (!parsed || !rawResponseId)
            throw new EditorialEngineError("invalid_output", "OpenAI returned an incomplete style review. Retry the request.");

        yield {
            type: EDITORIAL_ENGINE_EVENT.COMPLETED,
            responseId: rawResponseId,
            text: parsed.proposal,
            styleReview: styleReview(parsed, request.styleProfile),
        };
    }


    private async *streamTextProposal(prepared: PreparedEditorialRequest): AsyncIterable<EditorialEngineEvent> {
        const stream = await this.model.stream(prepared.messages, prepared.callOptions);
        
        let completeMessage: Awaited<ReturnType<typeof this.model.invoke>> | undefined;
        let text = "";

        for await (const chunk of stream) {
            text += chunk.text;
            completeMessage = completeMessage ? completeMessage.concat(chunk) : chunk;
            if (chunk.text)
                yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: chunk.text };
        }

        const completedResponseId = responseId(completeMessage);
        if (!completedResponseId || !text)
            throw new EditorialEngineError("incomplete_stream", "OpenAI ended before completing the proposal. Retry the request.");

        yield {
            type: EDITORIAL_ENGINE_EVENT.COMPLETED,
            responseId: completedResponseId,
            text,
        };
    }
}
