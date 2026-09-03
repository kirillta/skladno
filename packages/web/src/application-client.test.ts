import { afterEach, describe, expect, it, vi } from "vitest";

import { ArticleDraftConflictError, type Article } from "@skladno/shared";

import { HttpApplicationClient } from "./application-client.js";


const article: Article = {
    id: "article-1",
    title: "Article",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    currentRevisionId: "revision-1",
    currentRevision: {
        id: "revision-1",
        articleId: "article-1",
        content: "Saved",
        createdAt: "2026-01-01T00:00:00.000Z",
        provenance: { kind: "initial" },
    },
};


describe("HttpApplicationClient", () => {
    afterEach(() => vi.unstubAllGlobals());


    // product: application.local-service-client-contract
    it("maps a Draft conflict response to the typed renderer-safe error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: { code: "draft_conflict" },
            article: {
                ...article,
                draft: {
                    articleId: article.id,
                    content: "Checkpoint",
                    baseRevisionId: article.currentRevisionId,
                    version: 2,
                    updatedAt: "2026-01-01T00:01:00.000Z",
                },
            },
            draft: {
                articleId: article.id,
                content: "Checkpoint",
                baseRevisionId: article.currentRevisionId,
                version: 2,
                updatedAt: "2026-01-01T00:01:00.000Z",
            },
        }), { status: 409 })));

        await expect(new HttpApplicationClient().saveArticleDraft(article.id, {
            content: "New checkpoint",
            baseRevisionId: article.currentRevisionId,
            expectedDraftVersion: 1,
        })).rejects.toMatchObject({
            name: ArticleDraftConflictError.name,
            article,
            draft: { version: 2 },
        });
    });


    // product: application.recoverable-client-error
    it("maps a streamed Assistant failure to its stable error code", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("event: assistant\ndata: {\"type\":\"error\",\"requestId\":\"request-1\",\"errorCode\":\"editorial_provider_failed\",\"retryable\":true}\n\n")));

        await expect(new HttpApplicationClient().streamAssistantRequest(article.id, {
            kind: "new",
            requestId: "request-1",
            authorMessage: "Help with this Article.",
            scope: { kind: "article", baseRevisionId: article.currentRevisionId },
        }, vi.fn())).rejects.toMatchObject({
            code: "editorial_provider_failed",
        });
    });


    it("maps an Assistant rejection before streaming to its stable error code", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: {
                code: "editorial_request_failed",
            },
        }), { status: 500 })));

        await expect(new HttpApplicationClient().streamAssistantRequest(article.id, {
            kind: "new",
            requestId: "request-1",
            authorMessage: "Help with this Article.",
            scope: { kind: "article", baseRevisionId: article.currentRevisionId },
        }, vi.fn())).rejects.toMatchObject({
            code: "editorial_request_failed",
        });
    });
});
