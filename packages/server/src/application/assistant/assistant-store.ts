import type { AssistantCheckpointDraftMode, AssistantCheckpointPreview, AssistantMessage, AssistantRequest, AssistantRequestScope, AssistantResponseKind, AssistantSkillSource, BuiltInSkillId, RestoreAssistantCheckpointResult } from "@skladno/shared";


export class AssistantCheckpointError extends Error {
    constructor(readonly kind: "invalid" | "conflict") {
        super(kind);
    }
}


export interface AssistantStore {
    ensureGreeting(articleId: string): void;
    listMessages(articleId: string): AssistantMessage[];
    getRequest(requestId: string): AssistantRequest | undefined;
    createRequest(input: { id: string; articleId: string; authorMessage?: string; scope: AssistantRequestScope; explicitSkillId?: BuiltInSkillId; skillOffset?: number; targetLanguage?: string; retryOfRequestId?: string }): AssistantRequest;
    setAuthorMessage(requestId: string, content: string): void;
    resolveRequest(requestId: string, skillId: BuiltInSkillId | undefined, source: AssistantSkillSource | undefined): void;
    setExecution(requestId: string, capability: string, status?: "started" | "completed" | "failed" | "cancelled"): void;
    completeRun<T>(run: () => T): T;
    completeRequest(input: { requestId: string; articleId: string; skillId?: BuiltInSkillId; responseKind: AssistantResponseKind; content: string; proposalContent?: string; editorialArtifactId?: string }): AssistantMessage;
    rejectTranslation(articleId: string, editorialArtifactId: string): boolean;
    failRequest(requestId: string, status: "failed" | "cancelled", errorCode: string): void;
    previewCheckpoint(articleId: string, messageId: string): AssistantCheckpointPreview;
    restoreCheckpoint(articleId: string, messageId: string, tailToken: string, draftMode?: AssistantCheckpointDraftMode): RestoreAssistantCheckpointResult;
}
