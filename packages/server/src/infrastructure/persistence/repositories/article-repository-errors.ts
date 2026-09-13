import { APPLICATION_ERROR, HTTP_STATUS, type ApplicationErrorCode } from "@skladno/shared";

import { ApplicationServiceError } from "../../../application/errors/application-service-error.js";


function throwApplicationError(code: ApplicationErrorCode, status: number): never {
    throw new ApplicationServiceError(code, status);
}


export function throwInvalidArticleRequest(): never {
    return throwApplicationError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);
}


export function throwArticleNotFound(): never {
    return throwApplicationError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
}


export function throwRevisionNotFound(): never {
    return throwApplicationError(APPLICATION_ERROR.REVISION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
}


export function throwUnsupportedPublishingProfile(): never {
    return throwApplicationError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);
}


export function requireArticleTitle(value: string): string {
    if (!value.trim())
        throwInvalidArticleRequest();

    return value;
}
