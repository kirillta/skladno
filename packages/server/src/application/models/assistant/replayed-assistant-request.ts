import type { NewAssistantRequest } from "@skladno/shared";



export type ReplayedAssistantRequest = NewAssistantRequest & { articleId: string; retryOfRequestId?: string; };
