import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, articlesPath, HTTP_METHOD, HTTP_STATUS, isArticleLanguage, isPublishLimitProfileId, type AcceptProposalInput, type CreateArticleInput, type SaveArticleRevisionInput, type UpdateArticleInput } from "@skladno/shared";

import { ArticleService } from "../../application/articles/article-service.js";
import { ApplicationServiceError } from "../errors/application-error.js";
import { object, readJson, string, writeJson } from "../transport/json.js";


const ARTICLE_ROUTE_PATTERN = /^\/api\/articles\/([^/]+)(?:\/(draft|revisions|proposal-acceptances|revisions\/[^/]+\/restorations))?$/;
const ARTICLE_RESTORATION_PATTERN = /^revisions\/([^/]+)\/restorations$/;
const ARTICLE_RESOURCE = {
    DRAFT: "draft",
    REVISIONS: "revisions",
    PROPOSAL_ACCEPTANCES: "proposal-acceptances",
    RESTORATION: "restoration",
} as const;
type ArticleResource = typeof ARTICLE_RESOURCE[keyof typeof ARTICLE_RESOURCE];

interface ArticleRoute {
    articleId: string;
    resource?: ArticleResource;
    revisionId?: string;
}


function articleRoute(pathname: string): ArticleRoute | undefined {
    const routeMatch = ARTICLE_ROUTE_PATTERN.exec(pathname);
    if (!routeMatch)
        return undefined;

    const articleId = decodeURIComponent(routeMatch[1]);
    const resource = routeMatch[2];
    if (!resource)
        return { articleId };

    if (resource === ARTICLE_RESOURCE.DRAFT)
        return { articleId, resource: ARTICLE_RESOURCE.DRAFT };

    if (resource === ARTICLE_RESOURCE.REVISIONS)
        return { articleId, resource: ARTICLE_RESOURCE.REVISIONS };

    if (resource === ARTICLE_RESOURCE.PROPOSAL_ACCEPTANCES)
        return { articleId, resource: ARTICLE_RESOURCE.PROPOSAL_ACCEPTANCES };

    const restorationMatch = ARTICLE_RESTORATION_PATTERN.exec(resource);
    return restorationMatch
        ? { articleId, resource: ARTICLE_RESOURCE.RESTORATION, revisionId: decodeURIComponent(restorationMatch[1]) }
        : undefined;
}


function draftVersion(value: unknown): number {
    if (!Number.isInteger(value) || typeof value !== "number" || value < 1)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return value;
}


async function createArticle(request: IncomingMessage, response: ServerResponse, articles: ArticleService): Promise<boolean> {
    if (request.method !== HTTP_METHOD.POST)
        return false;

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

    writeJson(response, HTTP_STATUS.CREATED, articles.createArticle(input));
    return true;
}


function listArticles(response: ServerResponse, articles: ArticleService): boolean {
    writeJson(response, HTTP_STATUS.OK, articles.listArticles());
    return true;
}


async function updateArticle(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<boolean> {
    if (request.method !== HTTP_METHOD.PATCH)
        return false;

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

    writeJson(response, HTTP_STATUS.OK, articles.updateArticle(articleId, input));
    return true;
}


function deleteArticle(response: ServerResponse, articleId: string, articles: ArticleService): boolean {
    articles.deleteArticle(articleId);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();

    return true;
}


async function saveDraft(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<boolean> {
    if (request.method !== HTTP_METHOD.PUT)
        return false;

    const body = object(await readJson(request));
    const expectedDraftVersion = body.expectedDraftVersion;
    writeJson(response, HTTP_STATUS.OK, articles.saveDraft(articleId, {
        content: string(body.content, "content"),
        baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
        ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion: draftVersion(expectedDraftVersion) }),
    }));

    return true;
}


function discardDraft(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): boolean {
    if (request.method !== HTTP_METHOD.DELETE)
        return false;

    const expectedDraftVersion = new URL(request.url ?? "/", "http://localhost").searchParams.get("expectedDraftVersion");
    articles.discardDraft(articleId, draftVersion(Number(expectedDraftVersion)));
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();

    return true;
}


async function saveRevision(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<boolean> {
    if (request.method !== HTTP_METHOD.POST)
        return false;

    const body = object(await readJson(request));
    const expectedDraftVersion = body.expectedDraftVersion;
    const input: SaveArticleRevisionInput = {
        content: string(body.content, "content"),
        baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
        ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion: draftVersion(expectedDraftVersion) }),
    };

    writeJson(response, HTTP_STATUS.CREATED, articles.saveRevision(articleId, input));
    return true;
}


function listRevisions(response: ServerResponse, articleId: string, articles: ArticleService): boolean {
    writeJson(response, HTTP_STATUS.OK, articles.listRevisions(articleId));
    return true;
}


async function acceptProposal(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<boolean> {
    if (request.method !== HTTP_METHOD.POST)
        return false;

    const body = object(await readJson(request));
    const provenance = body.provenance;
    if (typeof provenance !== "object" || provenance === null || Array.isArray(provenance))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    const input: AcceptProposalInput = {
        baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
        content: string(body.content, "content"),
        provenance: provenance as Record<string, unknown>,
    };

    writeJson(response, HTTP_STATUS.CREATED, articles.acceptProposal(articleId, input));
    return true;
}


function restoreRevision(request: IncomingMessage, response: ServerResponse, articleId: string, revisionId: string, articles: ArticleService): boolean {
    if (request.method !== HTTP_METHOD.POST)
        return false;

    writeJson(response, HTTP_STATUS.CREATED, articles.restoreRevision(articleId, decodeURIComponent(revisionId)));
    return true;
}


export async function handleArticlesRoute(request: IncomingMessage, response: ServerResponse, pathname: string, articles: ArticleService): Promise<boolean> {
    if (pathname === articlesPath) {
        if (request.method === HTTP_METHOD.GET)
            return listArticles(response, articles);

        return createArticle(request, response, articles);
    }

    const route = articleRoute(pathname);
    if (!route)
        return false;

    const articleId = route.articleId;
    if (!articles.getArticle(articleId))
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    const resource = route.resource;
    if (!resource && request.method === HTTP_METHOD.DELETE)
        return deleteArticle(response, articleId, articles);

    if (!resource)
        return updateArticle(request, response, articleId, articles);

    if (resource === ARTICLE_RESOURCE.DRAFT) {
        if (request.method === HTTP_METHOD.PUT)
            return saveDraft(request, response, articleId, articles);

        return discardDraft(request, response, articleId, articles);
    }

    if (resource === ARTICLE_RESOURCE.REVISIONS) {
        if (request.method === HTTP_METHOD.GET)
            return listRevisions(response, articleId, articles);

        return saveRevision(request, response, articleId, articles);
    }

    if (resource === ARTICLE_RESOURCE.PROPOSAL_ACCEPTANCES)
        return acceptProposal(request, response, articleId, articles);

    if (resource === ARTICLE_RESOURCE.RESTORATION && route.revisionId)
        return restoreRevision(request, response, articleId, route.revisionId, articles);

    return false;
}
