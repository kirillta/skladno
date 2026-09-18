import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AssistantMessage } from "@skladno/shared";
import { useAssistantMessageHistory } from "./assistant-message-history-state.js";


function History({ listAssistantMessages }: { listAssistantMessages: (articleId: string) => Promise<AssistantMessage[]> }) {
    const [messages, setMessages] = useState<Record<string, AssistantMessage[]>>({});
    const client = useMemo(() => ({ listAssistantMessages }), [listAssistantMessages]);
    const { reload } = useAssistantMessageHistory({ client, articleId: "article", profileRebuilt: undefined, store: { setMessagesByArticle: setMessages } });

    useEffect(() => {
        void reload("article");
    }, [reload]);

    return <output>{messages.article ? messages.article.map((message) => message.content).join(",") || "empty" : "loading"}</output>;
}


describe("useAssistantMessageHistory", () => {
    it("does not restore an older response after a reload", async () => {
        let resolveInitial: ((messages: AssistantMessage[]) => void) | undefined;
        const listAssistantMessages = vi.fn()
            .mockImplementationOnce(() => new Promise<AssistantMessage[]>((resolve) => { resolveInitial = resolve; }))
            .mockResolvedValueOnce([]);

        render(<History listAssistantMessages={listAssistantMessages} />);
        await waitFor(() => expect(listAssistantMessages).toHaveBeenCalledTimes(2));
        resolveInitial?.([{ id: "stale", articleId: "article", role: "assistant", kind: "response", status: "completed", content: "stale translation", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]);

        await waitFor(() => expect(screen.getByText("empty")).toBeTruthy());
    });
});
