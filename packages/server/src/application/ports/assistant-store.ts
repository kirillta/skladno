import type { AssistantMessage, AssistantRequest, AssistantRequestScope, AssistantResponseKind, AssistantSkillSource, BuiltInSkillId } from "@skladno/shared";


export interface AssistantStore {
    ensureGreeting(articleId: string): void;
    listMessages(articleId: string): AssistantMessage[];
    getRequest(requestId: string): AssistantRequest | undefined;
    createRequest(input: { id: string; articleId: string; scope: AssistantRequestScope; explicitSkillId?: BuiltInSkillId; skillOffset?: number; retryOfRequestId?: string }): AssistantRequest;
    setAuthorMessage(requestId: string, content: string): void;
    resolveRequest(requestId: string, skillId: BuiltInSkillId | undefined, source: AssistantSkillSource | undefined): void;
    setExecution(requestId: string, capability: string): void;
    completeRequest(input: { requestId: string; articleId: string; skillId?: BuiltInSkillId; responseKind: AssistantResponseKind; content: string; proposalContent?: string; editorialArtifactId?: string }): AssistantMessage;
    failRequest(requestId: string, status: "failed" | "cancelled", errorCode: string): void;
}
