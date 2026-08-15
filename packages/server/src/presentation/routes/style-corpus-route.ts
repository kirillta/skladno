import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_STATUS, type CreateStyleCorpusItemInput } from "@skladno/shared";

import { StyleCorpusService } from "../../application/editorial/style-corpus-service.js";
import { object, readJson, string, writeJson } from "../transport/json.js";


export function handleStyleCorpusRoute(response: ServerResponse, styleCorpus: StyleCorpusService): void {
    writeJson(response, HTTP_STATUS.OK, styleCorpus.get());
}


export async function createStyleCorpusItemRoute(request: IncomingMessage, response: ServerResponse, styleCorpus: StyleCorpusService): Promise<void> {
    const body = object(await readJson(request));
    const input: CreateStyleCorpusItemInput = { name: typeof body.name === "string" ? body.name : undefined, content: string(body.content, "content") };

    writeJson(response, HTTP_STATUS.CREATED, await styleCorpus.add(input, new AbortController().signal));
}


export function deleteStyleCorpusItemRoute(response: ServerResponse, itemId: string, styleCorpus: StyleCorpusService): void {
    styleCorpus.remove(itemId);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}


export async function updateStyleCorpusItemRoute(request: IncomingMessage, response: ServerResponse, itemId: string, styleCorpus: StyleCorpusService): Promise<void> {
    const body = object(await readJson(request));
    if (typeof body.included !== "boolean")
        throw new Error("included must be a boolean.");

    writeJson(response, HTTP_STATUS.OK, styleCorpus.setIncluded(itemId, body.included));
}


export async function updateStyleCorpusRulesRoute(request: IncomingMessage, response: ServerResponse, styleCorpus: StyleCorpusService): Promise<void> {
    const body = object(await readJson(request));
    writeJson(response, HTTP_STATUS.OK, styleCorpus.setRules(string(body.rules, "rules")));
}


export function rebuildStyleCorpusRoute(response: ServerResponse, styleCorpus: StyleCorpusService): void {
    writeJson(response, HTTP_STATUS.OK, styleCorpus.rebuild());
}


export function getArticleStyleRulesRoute(response: ServerResponse, articleId: string, styleCorpus: StyleCorpusService): void {
    writeJson(response, HTTP_STATUS.OK, { rules: styleCorpus.getArticleRules(articleId) });
}


export async function setArticleStyleRulesRoute(request: IncomingMessage, response: ServerResponse, articleId: string, styleCorpus: StyleCorpusService): Promise<void> {
    const body = object(await readJson(request));
    writeJson(response, HTTP_STATUS.OK, { rules: styleCorpus.setArticleRules(articleId, string(body.rules, "rules")) });
}
