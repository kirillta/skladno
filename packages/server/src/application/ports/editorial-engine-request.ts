import type { EditorialOperation, StyleProfile } from "@skladno/shared";


export interface EditorialEngineRequest {
    operation: EditorialOperation;
    article: string;
    authorContext: string;
    styleProfile?: StyleProfile;
    previousResponseId?: string;
    targetLanguage?: string;
}
