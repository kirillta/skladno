import type { AssistantCheckpointDraftMode, AssistantCheckpointPreview, AssistantEditCandidate, AssistantEditMode, AssistantMessage, AssistantRequest, AssistantRequestScope, AssistantResponseKind, AssistantSkillSource, ArticleRevision, RestoreAssistantCheckpointResult } from "@skladno/shared";


export class AssistantCheckpointError extends Error {
    constructor(readonly kind: "invalid" | "conflict") {
        super(kind);
    }
}


export class AssistantEditError extends Error {
    constructor(readonly kind: "invalid" | "conflict") {
        super(kind);
    }
}


export interface AssistantStore {
    ensureGreeting(articleId: string): void;
    listMessages(articleId: string): AssistantMessage[];
    getEditMode(articleId: string, defaultMode: AssistantEditMode): AssistantEditMode;
    setEditMode(articleId: string, mode: AssistantEditMode): AssistantEditMode;
    previewEdit(articleId: string, messageId: string): { previousContent: string; content: string } | undefined;
    applyEdit(articleId: string, messageId: string, description?: string): ArticleRevision;
    getRequest(requestId: string): AssistantRequest | undefined;
    createRequest(input: { id: string; articleId: string; authorMessage?: string; scope: AssistantRequestScope; explicitSkillId?: string; skillOffset?: number; targetLanguage?: string; retryOfRequestId?: string }): AssistantRequest;
    setAuthorMessage(requestId: string, content: string): void;
    resolveRequest(requestId: string, skillId: string | undefined, source: AssistantSkillSource | undefined): void;
    setExecution(requestId: string, capability: string, status?: "started" | "completed" | "failed" | "cancelled"): void;
    completeRun<T>(run: () => T): T;
    completeRequest(input: { requestId: string; articleId: string; skillId?: string; responseKind: AssistantResponseKind; content: string; proposalContent?: string; editorialArtifactId?: string; editCandidate?: AssistantEditCandidate; directEdit?: boolean; editDescription?: string }): AssistantMessage;
    rejectTranslation(articleId: string, editorialArtifactId: string): boolean;
    failRequest(requestId: string, status: "failed" | "cancelled", errorCode: string): void;
    previewCheckpoint(articleId: string, messageId: string): AssistantCheckpointPreview;
    restoreCheckpoint(articleId: string, messageId: string, tailToken: string, draftMode?: AssistantCheckpointDraftMode): RestoreAssistantCheckpointResult;
}
