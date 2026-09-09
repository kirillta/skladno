import { APPLICATION_ERROR, HTTP_STATUS, type ApplicationErrorCode } from "@skladno/shared";

import { ApplicationServiceError } from "../../../application/errors/application-service-error.js";


function applicationError(code: ApplicationErrorCode, status: number): never {
    throw new ApplicationServiceError(code, status);
}


export function invalidArticleRequest(): never {
    return applicationError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);
}


export function articleNotFound(): never {
    return applicationError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
}


export function revisionNotFound(): never {
    return applicationError(APPLICATION_ERROR.REVISION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
}


export function unsupportedPublishingProfile(): never {
    return applicationError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);
}


export function requireArticleTitle(value: string): string {
    if (!value.trim())
        invalidArticleRequest();

    return value;
}
