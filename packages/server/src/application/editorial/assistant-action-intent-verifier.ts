import type { AssistantAuthorizedAction } from "@skladno/shared";


export interface AssistantActionIntentVerifier {
    verify(message: string, capability: AssistantAuthorizedAction, input: Readonly<Record<string, string>>, signal: AbortSignal): Promise<boolean>;
    verifyReplacement?(message: string, source: string, replacement: string, target: "selection" | "article", signal: AbortSignal): Promise<boolean>;
}
