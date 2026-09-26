import { APPLICATION_ERROR } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import { EDITORIAL_ENGINE_ERROR } from "../../editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../editorial/engine/editorial-engine-error.js";


export function getAssistantRequestErrorCode(error: unknown) {
    if (error instanceof ApplicationServiceError)
        return error.code;

    return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
        ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
        : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}
