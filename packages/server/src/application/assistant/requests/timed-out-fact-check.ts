import { APPLICATION_ERROR } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import type { AssistantCompletion } from "../completion/assistant-completion.js";
import type { PreparedAssistantRequest } from "./prepared-assistant-request.js";


export function persistTimedOutFactCheck(error: unknown, request: PreparedAssistantRequest, signal: AbortSignal, completion: AssistantCompletion): ReturnType<AssistantCompletion["persistPartialFactCheck"]> | undefined {
    const partial = request.partialFactCheck;
    if (signal.aborted || !(error instanceof ApplicationServiceError) || error.code !== APPLICATION_ERROR.ASSISTANT_REQUEST_TIMED_OUT || !partial?.findings.length)
        return undefined;

    return completion.persistPartialFactCheck(request, partial);
}
