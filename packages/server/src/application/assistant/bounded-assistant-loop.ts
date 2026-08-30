import { editorialCapabilityDefinitions, isValidatedEditorialCapabilityCall } from "./editorial-capability-catalog.js";
import { EDITORIAL_ENGINE_ERROR } from "../ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../ports/editorial-engine-error.js";


export const ASSISTANT_LOOP_STEP_LIMIT = 6;


export interface AssistantToolCall {
    capability: string;
    input: Readonly<Record<string, string>>;
}


export type AssistantLoopModelStep =
    | { kind: "tool-call"; call: AssistantToolCall }
    | { kind: "completed"; text: string };


export interface AssistantLoopModel {
    next(signal: AbortSignal): Promise<AssistantLoopModelStep>;
}


export interface AssistantToolExecutor {
    execute(call: AssistantToolCall, signal: AbortSignal): Promise<unknown>;
}


export type AssistantLoopResult =
    | { kind: "completed"; text: string; staged: unknown[] }
    | { kind: "cancelled" }
    | { kind: "exhausted" }
    | { kind: "invalid-call" }
    | { kind: "failed" };


function canRetry(call: AssistantToolCall, error: unknown): boolean {
    return editorialCapabilityDefinitions.find((definition) => definition.id === call.capability)?.retry === "transient-read"
        && error instanceof EditorialEngineError
        && error.code === EDITORIAL_ENGINE_ERROR.NETWORK;
}


export class BoundedAssistantLoop {
    constructor(
        private readonly model: AssistantLoopModel,
        private readonly tools: AssistantToolExecutor,
    ) { }


    async run(signal: AbortSignal): Promise<AssistantLoopResult> {
        const staged: unknown[] = [];
        for (let step = 0; step < ASSISTANT_LOOP_STEP_LIMIT; step += 1) {
            if (signal.aborted)
                return { kind: "cancelled" };

            let modelStep: AssistantLoopModelStep;
            try {
                modelStep = await this.model.next(signal);
            } catch {
                return signal.aborted ? { kind: "cancelled" } : { kind: "failed" };
            }

            if (modelStep.kind === "completed")
                return { kind: "completed", text: modelStep.text, staged };

            if (!isValidatedEditorialCapabilityCall(modelStep.call.capability, modelStep.call.input))
                return { kind: "invalid-call" };

            try {
                staged.push(await this.tools.execute(modelStep.call, signal));
            } catch (error) {
                if (signal.aborted)
                    return { kind: "cancelled" };

                if (!canRetry(modelStep.call, error))
                    return { kind: "failed" };

                try {
                    staged.push(await this.tools.execute(modelStep.call, signal));
                } catch {
                    return signal.aborted ? { kind: "cancelled" } : { kind: "failed" };
                }
            }
        }

        return { kind: "exhausted" };
    }
}
