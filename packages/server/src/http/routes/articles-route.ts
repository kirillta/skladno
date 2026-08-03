import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, articlesPath, HTTP_METHOD, HTTP_STATUS, isArticleLanguage, isPublishLimitProfileId, type AcceptProposalInput, type CreateArticleInput, type UpdateArticleInput, type SaveArticleRevisionInput } from "@skladno/shared";

import { Repositories } from "../../persistence/index.js";
import { object, readJson, string, writeJson } from "../json.js";
import { ApplicationServiceError } from "../application-error.js";


function draftVersion(value: unknown): number {
    if (!Number.isInteger(value) || typeof value !== "number" || value < 1)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return value;
}


export async function handleArticlesRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (request.method === HTTP_METHOD.GET && pathname === articlesPath) {
        writeJson(response, HTTP_STATUS.OK, repositories.listArticles());
        return true;
    }

    if (request.method === HTTP_METHOD.POST && pathname === articlesPath) {
        const body = object(await readJson(request));
        const publishingProfileId = body.publishingProfileId === undefined ? undefined : string(body.publishingProfileId, "publishingProfileId");
        if (publishingProfileId !== undefined && !isPublishLimitProfileId(publishingProfileId))
            throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

        const language = body.language === undefined ? undefined : string(body.language, "language");
        if (language !== undefined && !isArticleLanguage(language))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const input: CreateArticleInput = {
            title: string(body.title, "title"),
            content: string(body.content, "content"),
            ...(language === undefined ? {} : { language }),
            ...(body.audience === undefined ? {} : { audience: string(body.audience, "audience") }),
            ...(publishingProfileId === undefined ? {} : { publishingProfileId }),
            ...(body.sourceArticleId === undefined ? {} : { sourceArticleId: string(body.sourceArticleId, "sourceArticleId") }),
            ...(body.sourceRevisionId === undefined ? {} : { sourceRevisionId: string(body.sourceRevisionId, "sourceRevisionId") }),
        };

        writeJson(response, HTTP_STATUS.CREATED, repositories.createArticle(input));
        return true;
    }

    const match = /^\/api\/articles\/([^/]+)(?:\/(draft|revisions|proposal-acceptances|revisions\/[^/]+\/restorations))?$/.exec(pathname);
    if (!match)
        return false;

    const articleId = decodeURIComponent(match[1]);
    if (!repositories.getArticle(articleId))
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    if (request.method === HTTP_METHOD.DELETE && !match[2]) {
        repositories.deleteArticle(articleId);
        response.writeHead(HTTP_STATUS.NO_CONTENT);
        response.end();

        return true;
    }

    if (request.method === HTTP_METHOD.PATCH && !match[2]) {
        const body = object(await readJson(request));
        const title = body.title === undefined ? undefined : string(body.title, "title");
        const language = body.language === undefined ? undefined : string(body.language, "language");
        const publishingProfileId = body.publishingProfileId === undefined ? undefined : string(body.publishingProfileId, "publishingProfileId");

        if (language !== undefined && !isArticleLanguage(language))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        if (publishingProfileId !== undefined && !isPublishLimitProfileId(publishingProfileId))
            throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

        const input: UpdateArticleInput = {
            ...(title === undefined ? {} : { title }),
            ...(language === undefined ? {} : { language }),
            ...(publishingProfileId === undefined ? {} : { publishingProfileId }),
        };

        if (Object.keys(input).length === 0)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        writeJson(response, HTTP_STATUS.OK, repositories.updateArticle(articleId, input));
        return true;
    }

    if (request.method === HTTP_METHOD.PUT && match[2] === "draft") {
        const body = object(await readJson(request));
        const expectedDraftVersion = body.expectedDraftVersion;

        writeJson(response, HTTP_STATUS.OK, repositories.saveArticleDraft(articleId, {
            content: string(body.content, "content"),
            baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
            ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion: draftVersion(expectedDraftVersion) }),
        }));

        return true;
    }

    if (request.method === HTTP_METHOD.DELETE && match[2] === "draft") {
        const expectedDraftVersion = new URL(request.url ?? "/", "http://localhost").searchParams.get("expectedDraftVersion");
        repositories.discardArticleDraft(articleId, draftVersion(Number(expectedDraftVersion)));

        response.writeHead(HTTP_STATUS.NO_CONTENT);
        response.end();

        return true;
    }

    if (request.method === HTTP_METHOD.POST && match[2] === "revisions") {
        const body = object(await readJson(request));
        const expectedDraftVersion = body.expectedDraftVersion;

        const input: SaveArticleRevisionInput = {
            content: string(body.content, "content"),
            baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
            ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion: draftVersion(expectedDraftVersion) }),
        };

        writeJson(response, HTTP_STATUS.CREATED, repositories.saveArticleRevision(articleId, input));
        return true;
    }

    if (request.method === HTTP_METHOD.GET && match[2] === "revisions") {
        writeJson(response, HTTP_STATUS.OK, repositories.listArticleRevisions(articleId));
        return true;
    }

    if (request.method === HTTP_METHOD.POST && match[2] === "proposal-acceptances") {
        const body = object(await readJson(request));
        const provenance = body.provenance;
        if (typeof provenance !== "object" || provenance === null || Array.isArray(provenance))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const input: AcceptProposalInput = {
            baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
            content: string(body.content, "content"),
            provenance: provenance as Record<string, unknown>,
        };

        writeJson(response, HTTP_STATUS.CREATED, repositories.acceptProposal(articleId, input));
        return true;
    }

    const restore = /^revisions\/([^/]+)\/restorations$/.exec(match[2] ?? "");
    if (request.method === HTTP_METHOD.POST && restore) {
        writeJson(response, HTTP_STATUS.CREATED, repositories.restoreRevision(articleId, decodeURIComponent(restore[1])));
        return true;
    }

    return false;
}
