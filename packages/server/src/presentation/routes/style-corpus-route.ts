import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_STATUS, type CreateStyleCorpusItemInput } from "@skladno/shared";

import { StyleCorpusService } from "../../application/editorial/style-corpus-service.js";
import { object, readJson, string, writeJson } from "../transport/json.js";


export function handleStyleCorpusRoute(response: ServerResponse, styleCorpus: StyleCorpusService): void {
    writeJson(response, HTTP_STATUS.OK, styleCorpus.get());
}


export async function createStyleCorpusItemRoute(request: IncomingMessage, response: ServerResponse, styleCorpus: StyleCorpusService): Promise<void> {
    const body = object(await readJson(request));
    const input: CreateStyleCorpusItemInput = { name: string(body.name, "name"), content: string(body.content, "content") };

    writeJson(response, HTTP_STATUS.CREATED, styleCorpus.add(input));
}


export function deleteStyleCorpusItemRoute(response: ServerResponse, itemId: string, styleCorpus: StyleCorpusService): void {
    styleCorpus.remove(itemId);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}
