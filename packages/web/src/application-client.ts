import {
    DocumentConflictError,
    documentsPath,
    healthPath,
    HTTP_STATUS,
    parseHealthResponse,
    type ApplicationClient,
    type CreateDocumentInput,
    type Document,
    type HealthResponse,
    type SaveDocumentDraftInput,
    type DocumentVersion,
    type WorkspaceClient,
} from "@skladno/shared";

/** HTTP implementation of the UI's transport-neutral application boundary. */
export class HttpApplicationClient implements ApplicationClient, WorkspaceClient {
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
        return this.request<Document>(documentsPath, { method: "POST", body: JSON.stringify(input) });
    }


    async renameDocument(documentId: string, title: string): Promise<Document> {
        return this.request<Document>(`${documentsPath}/${encodeURIComponent(documentId)}`, { method: "PATCH", body: JSON.stringify({ title }) });
    }


    async deleteDocument(documentId: string): Promise<void> {
        await this.request<void>(`${documentsPath}/${encodeURIComponent(documentId)}`, { method: "DELETE" });
    }


    async saveDraft(documentId: string, input: SaveDocumentDraftInput): Promise<DocumentVersion> {
        return this.request<DocumentVersion>(`${documentsPath}/${encodeURIComponent(documentId)}/draft`, { method: "PUT", body: JSON.stringify(input) });
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
