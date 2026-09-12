import { isStepCount, ToolLoopAgent, type LanguageModel, type ToolSet } from "ai";
import { randomUUID } from "node:crypto";
import type { AiProvider, ReasoningEffort } from "@skladno/shared";

import type { EditorialAssistantRequest } from "../../../application/models/editorial/editorial-assistant-request.js";
import type { EditorialEngineEvent } from "../../../application/models/editorial/editorial-engine-event.js";
import { EDITORIAL_ENGINE_ERROR } from "../../../application/errors/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../../application/models/editorial/editorial-engine-events.js";
import { EditorialEngineError } from "../../../application/errors/editorial-engine-error.js";
import { assistantConversationPrompt, assistantStepOptions, createAssistantTools } from "./ai-sdk-assistant.js";
import { continuationToken, editorialProviderOptions, isAcceptedFinish } from "./ai-sdk-provider.js";


interface AiSdkAssistantExecutorOptions {
    languageModel: LanguageModel;
    provider: AiProvider;
    storeResponses: boolean;
    reasoningEffort?: ReasoningEffort;
}


export class AiSdkAssistantExecutor {
    constructor(private readonly options: AiSdkAssistantExecutorOptions) { }


    async *stream(request: EditorialAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const state = { activeCapabilities: request.initialActiveCapabilities };
        const execute = (capability: string, input: Readonly<Record<string, string>>) => this.executeCapability(request, signal, state, capability, input);
        const agent = this.createAgent(request, createAssistantTools(request, execute), state);
        const result = await agent.stream({ prompt: assistantConversationPrompt(request), abortSignal: signal });
        let text = "";
        for await (const delta of result.textStream) {
            text += delta;
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta };
        }

        const steps = await result.steps;
        const finalStep = await result.finalStep;
        if (!text.trim() || signal.aborted || !isAcceptedFinish(finalStep.finishReason) || (steps.length >= 6 && finalStep.finishReason === "tool-calls"))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);

        const token = continuationToken({ provider: this.options.provider, storeResponses: this.options.storeResponses, metadata: finalStep.providerMetadata });
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: randomUUID(), ...(token ? { continuationToken: token } : {}), text };
    }


    private async executeCapability(request: EditorialAssistantRequest, signal: AbortSignal, state: { activeCapabilities?: readonly string[] }, capability: string, input: Readonly<Record<string, string>>): Promise<unknown> {
        const candidate = request.tools.find((toolCandidate) => toolCandidate.capability === capability);
        if (!candidate)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const result = await candidate.execute(input, signal);
        if (capability === "find_capabilities" && Array.isArray(result))
            state.activeCapabilities = result.flatMap((item) => item && typeof item === "object" && "capability" in item && typeof item.capability === "string" ? [item.capability] : []);

        return result;
    }


    private createAgent(request: EditorialAssistantRequest, tools: ToolSet, state: { activeCapabilities?: readonly string[] }) {
        const activeTools = () => state.activeCapabilities ? [...state.activeCapabilities, "load_skill"] : ["find_capabilities", "load_skill"];
        const providerOptions = editorialProviderOptions(this.options);

        return new ToolLoopAgent<never, ToolSet>({
            model: this.options.languageModel,
            instructions: [
                "You are Skladno's editorial assistant. Use only the supplied tools when an editorial result is needed.",
                "Never claim that a tool ran when it did not. Preserve author control. Finish with a concise response after the necessary work.",
                `Available Skills:\n${request.skills.map((skill) => `${skill.id}: ${skill.name}. ${skill.description}`).join("\n")}`,
                ...request.instructions,
            ].join("\n\n"),
            tools,
            activeTools: activeTools(),
            prepareStep: ({ stepNumber }) => assistantStepOptions(stepNumber, state.activeCapabilities),
            stopWhen: isStepCount(6),
            telemetry: { isEnabled: false },
            ...(providerOptions ? { providerOptions } : {}),
        });
    }
}
