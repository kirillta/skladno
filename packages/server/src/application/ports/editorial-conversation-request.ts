export interface EditorialConversationRequest {
    message: string;
    article: string;
    scope: "article" | "selection";
    history: { role: "author" | "assistant"; content: string }[];
}
