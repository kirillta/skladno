import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, HTTP_STATUS, isArticleLanguage, isPublishLimitProfileId, type AcceptProposalInput, type CreateArticleInput, type SaveArticleRevisionInput, type UpdateArticleInput } from "@skladno/shared";

import { ArticleService } from "../../application/articles/article-service.js";
import { ApplicationServiceError } from "../errors/application-error.js";
import { object, readJson, string, writeJson } from "../transport/json.js";


function draftVersion(value: unknown): number {
    if (!Number.isInteger(value) || typeof value !== "number" || value < 1)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return value;
}


function requireArticle(articleId: string, articles: ArticleService): void {
    if (!articles.getArticle(articleId))
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
}


export async function createArticleRoute(request: IncomingMessage, response: ServerResponse, articles: ArticleService): Promise<void> {
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
}


export function listArticlesRoute(response: ServerResponse, articles: ArticleService): void {
    writeJson(response, HTTP_STATUS.OK, articles.listArticles());
}


export async function updateArticleRoute(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<void> {
    requireArticle(articleId, articles);

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
}


export function deleteArticleRoute(response: ServerResponse, articleId: string, articles: ArticleService): void {
    requireArticle(articleId, articles);

    articles.deleteArticle(articleId);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();

}


export async function saveDraftRoute(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<void> {
    requireArticle(articleId, articles);

    const body = object(await readJson(request));
    const expectedDraftVersion = body.expectedDraftVersion;
    writeJson(response, HTTP_STATUS.OK, articles.saveDraft(articleId, {
        content: string(body.content, "content"),
        baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
        ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion: draftVersion(expectedDraftVersion) }),
    }));

}


export function discardDraftRoute(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): void {
    requireArticle(articleId, articles);

    const expectedDraftVersion = new URL(request.url ?? "/", "http://localhost").searchParams.get("expectedDraftVersion");
    articles.discardDraft(articleId, draftVersion(Number(expectedDraftVersion)));
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();

}


export async function saveRevisionRoute(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<void> {
    requireArticle(articleId, articles);

    const body = object(await readJson(request));
    const expectedDraftVersion = body.expectedDraftVersion;
    const input: SaveArticleRevisionInput = {
        content: string(body.content, "content"),
        baseRevisionId: string(body.baseRevisionId, "baseRevisionId"),
        ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion: draftVersion(expectedDraftVersion) }),
    };

    writeJson(response, HTTP_STATUS.CREATED, articles.saveRevision(articleId, input));
}


export function listRevisionsRoute(response: ServerResponse, articleId: string, articles: ArticleService): void {
    requireArticle(articleId, articles);

    writeJson(response, HTTP_STATUS.OK, articles.listRevisions(articleId));
}


export async function acceptProposalRoute(request: IncomingMessage, response: ServerResponse, articleId: string, articles: ArticleService): Promise<void> {
    requireArticle(articleId, articles);

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
}


export function restoreRevisionRoute(response: ServerResponse, articleId: string, revisionId: string, articles: ArticleService): void {
    requireArticle(articleId, articles);

    writeJson(response, HTTP_STATUS.CREATED, articles.restoreRevision(articleId, revisionId));
}
