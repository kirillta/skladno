import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";

import { Router } from "./router.js";


test("Router dispatches one matching method and decodes route parameters", async () => {
    const router = new Router();
    let articleId: string | undefined;
    router.register("GET", /^\/api\/articles\/([^/]+)$/, (_request, _response, parameters) => {
        articleId = parameters[0];
    });

    const request = { method: "GET" } as IncomingMessage;
    const response = {} as ServerResponse;
    assert.equal(await router.handle(request, response, "/api/articles/article%20id"), true);
    assert.equal(articleId, "article id");
    assert.equal(await router.handle({ method: "POST" } as IncomingMessage, response, "/api/articles/article%20id"), false);
});
