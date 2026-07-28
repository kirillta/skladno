import type { IncomingMessage, ServerResponse } from "node:http";
import { documentsPath, HTTP_METHOD, HTTP_STATUS, type CreateDocumentInput, type SaveDocumentDraftInput } from "@skladno/shared";

import { Repositories } from "../../persistence/index.js";
import { object, readJson, string, writeJson } from "../json.js";


export async function handleDocumentsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (request.method === HTTP_METHOD.GET && pathname === documentsPath) {
        writeJson(response, HTTP_STATUS.OK, repositories.listDocuments());
        return true;
    }

    if (request.method === HTTP_METHOD.POST && pathname === documentsPath) {
        const body = object(await readJson(request));
        const input: CreateDocumentInput = { title: string(body.title, "title"), content: string(body.content, "content") };

        writeJson(response, HTTP_STATUS.CREATED, repositories.createDocument(input));
        return true;
    }

    const match = /^\/api\/documents\/([^/]+)(?:\/(draft))?$/.exec(pathname);
    if (!match)
        return false;

    const documentId = decodeURIComponent(match[1]);
    if (request.method === HTTP_METHOD.DELETE && !match[2]) {
        repositories.deleteDocument(documentId);
        response.writeHead(HTTP_STATUS.NO_CONTENT);
        response.end();

        return true;
    }

    if (request.method === HTTP_METHOD.PATCH && !match[2]) {
        const body = object(await readJson(request));
        
        writeJson(response, HTTP_STATUS.OK, repositories.renameDocument(documentId, string(body.title, "title")));
        return true;
    }

    if (request.method === HTTP_METHOD.PUT && match[2] === "draft") {
        const body = object(await readJson(request));
        const input: SaveDocumentDraftInput = { content: string(body.content, "content"), baseVersionId: string(body.baseVersionId, "baseVersionId") };
        
        writeJson(response, HTTP_STATUS.OK, repositories.saveDraft(documentId, input));
        return true;
    }
    
    return false;
}
