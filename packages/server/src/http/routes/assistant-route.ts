import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_METHOD, HTTP_STATUS } from "@skladno/shared";

import { Repositories } from "../../persistence/index.js";
import { writeJson } from "../json.js";
import { ApplicationServiceError } from "../application-error.js";
import { APPLICATION_ERROR } from "@skladno/shared";

export function handleAssistantRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): boolean {
    const match = /^\/api\/articles\/([^/]+)\/assistant\/messages$/.exec(pathname);
    if (!match || request.method !== HTTP_METHOD.GET)
        return false;

    const articleId = decodeURIComponent(match[1]);
    if (!repositories.getArticle(articleId))
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    writeJson(response, HTTP_STATUS.OK, repositories.listAssistantMessages(articleId));
    return true;
}
