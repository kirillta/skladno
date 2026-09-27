import { APPLICATION_ERROR } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import type { AssistantCompletion } from "../completion/assistant-completion.js";
import type { PreparedAssistantRequest } from "./prepared-assistant-request.js";


export function persistInterruptedFactCheck(error: unknown, request: PreparedAssistantRequest, signal: AbortSignal, completion: AssistantCompletion): ReturnType<AssistantCompletion["persistPartialFactCheck"]> | undefined {
    if (error instanceof ApplicationServiceError && error.code !== APPLICATION_ERROR.ASSISTANT_REQUEST_TIMED_OUT)
        return undefined;

    const partial = request.partialFactCheck;
    if (signal.aborted || !partial?.findings.length)
        return undefined;

    return completion.persistPartialFactCheck(request, partial);
}
