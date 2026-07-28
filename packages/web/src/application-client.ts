import {
    DocumentConflictError,
    acceptProposalPath,
    documentsPath,
    documentVersionsPath,
    editorialPath,
    healthPath,
    HTTP_METHOD,
    HTTP_STATUS,
    parseHealthResponse,
    type ApplicationClient,
    type CreateDocumentInput,
    type Document,
    type HealthResponse,
    type SaveDocumentDraftInput,
    type AcceptProposalInput,
    type DocumentVersion,
    type WorkspaceClient,
    type EditorialClient,
    type EditorialEvent,
    type StartEditorialRequest,
    restoreVersionPath,
    styleCorpusPath,
    type CreateStyleCorpusItemInput,
    type StyleCorpus,
    type StyleCorpusClient,
} from "@skladno/shared";

/** HTTP implementation of the UI's transport-neutral application boundary. */
export class HttpApplicationClient implements ApplicationClient, WorkspaceClient, EditorialClient, StyleCorpusClient {
    constructor(private readonly serviceUrl = "http://127.0.0.1:8787") { }

    async getHealth(): Promise<HealthResponse> {
        const response = await fetch(`${this.serviceUrl}${healthPath}`);
        if (!response.ok) {
            throw new Error(`The local service could not be reached (${response.status}).`);
        }

        return parseHealthResponse(await response.json());
    }


    async listDocuments(): Promise<Document[]> {
        return this.request<Document[]>(documentsPath);
    }


    async createDocument(input: CreateDocumentInput): Promise<Document> {
        return this.request<Document>(documentsPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async renameDocument(documentId: string, title: string): Promise<Document> {
        return this.request<Document>(`${documentsPath}/${encodeURIComponent(documentId)}`, { method: HTTP_METHOD.PATCH, body: JSON.stringify({ title }) });
    }


    async deleteDocument(documentId: string): Promise<void> {
        await this.request<void>(`${documentsPath}/${encodeURIComponent(documentId)}`, { method: HTTP_METHOD.DELETE });
    }


    async saveDraft(documentId: string, input: SaveDocumentDraftInput): Promise<DocumentVersion> {
        return this.request<DocumentVersion>(`${documentsPath}/${encodeURIComponent(documentId)}/draft`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async listVersions(documentId: string): Promise<DocumentVersion[]> {
        return this.request<DocumentVersion[]>(documentVersionsPath(documentId));
    }


    async acceptProposal(documentId: string, input: AcceptProposalInput): Promise<DocumentVersion> {
        return this.request<DocumentVersion>(acceptProposalPath(documentId), { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async restoreVersion(documentId: string, versionId: string): Promise<DocumentVersion> {
        return this.request<DocumentVersion>(restoreVersionPath(documentId, versionId), { method: HTTP_METHOD.POST });
    }


    async getStyleCorpus(): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusPath);
    }


    async addStyleCorpusItem(input: CreateStyleCorpusItemInput): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async removeStyleCorpusItem(materialId: string): Promise<void> {
        await this.request<void>(`${styleCorpusPath}/${encodeURIComponent(materialId)}`, { method: HTTP_METHOD.DELETE });
    }


    async streamEditorial(documentId: string, input: StartEditorialRequest, onEvent: (event: EditorialEvent) => void, signal?: AbortSignal): Promise<void> {
        const response = await fetch(`${this.serviceUrl}${editorialPath(documentId)}`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal,
        });

        if (!response.ok || !response.body)
            throw new Error(`The editorial service could not be reached (${response.status}).`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            
            const messages = buffer.split("\n\n");
            buffer = messages.pop() ?? "";

            for (const message of messages) {
                const data = message.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
                if (!data)
                    continue;

                onEvent(JSON.parse(data) as EditorialEvent);
            }

            if (done)
                return;
        }
    }


    private async request<T>(path: string, init?: RequestInit): Promise<T> {
        const response = await fetch(`${this.serviceUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
        if (response.status === HTTP_STATUS.NO_CONTENT) 
            return undefined as T;

        const body: unknown = await response.json().catch(() => ({}));
        if (response.status === HTTP_STATUS.CONFLICT && typeof body === "object" && body !== null && "document" in body) {
            throw new DocumentConflictError((body as { document: Document }).document);
        }

        if (!response.ok) {
            const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" 
                ? body.error 
                : `The local service could not be reached (${response.status}).`;
            
            throw new Error(message);
        }
        
        return body as T;
    }
}
