import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_METHOD, HTTP_STATUS, styleCorpusPath, type CreateStyleCorpusItemInput } from "@skladno/shared";

import { Repositories } from "../../persistence/index.js";
import { object, readJson, string, writeJson } from "../json.js";


export async function handleStyleCorpusRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (request.method === HTTP_METHOD.GET && pathname === styleCorpusPath) {
        writeJson(response, HTTP_STATUS.OK, repositories.getStyleCorpus());
        return true;
    }

    if (request.method === HTTP_METHOD.POST && pathname === styleCorpusPath) {
        const body = object(await readJson(request));
        const input: CreateStyleCorpusItemInput = { name: string(body.name, "name"), content: string(body.content, "content") };
        writeJson(response, HTTP_STATUS.CREATED, repositories.addStyleCorpusItem(input));
        return true;
    }

    const match = /^\/api\/style-corpus\/([^/]+)$/.exec(pathname);
    if (request.method === HTTP_METHOD.DELETE && match) {
        repositories.removeStyleCorpusItem(decodeURIComponent(match[1]));
        response.writeHead(HTTP_STATUS.NO_CONTENT);
        response.end();
        return true;
    }

    return false;
}
