import type { StartAssistantRequest } from "@skladno/shared";



export type AssistantServiceRequest = StartAssistantRequest & { articleId: string; };
