import type { AssistantMessage } from "@skladno/shared";


export type ConversationHistory = { role: "author" | "assistant"; content: string }[];


export function getConversationHistory(assistant: { listMessages(articleId: string): AssistantMessage[] }, articleId: string, limit?: number): ConversationHistory {
    const history = assistant.listMessages(articleId).flatMap((message) => {
        const isHistoryMessage = message.role === "author" || (message.role === "assistant" && message.kind === "response");
        if (!isHistoryMessage || !message.content)
            return [];

        return [{ role: message.role === "author" ? "author" as const : "assistant" as const, content: message.content }];
    });

    return limit === undefined ? history : history.slice(-limit);
}
