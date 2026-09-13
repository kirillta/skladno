import type { AssistantAuthorizedAction } from "@skladno/shared";


export interface EditorialCapabilityContext {
    articleId: string;
    baseRevisionId: string;
    authorizedActions?: readonly AssistantAuthorizedAction[];
}
