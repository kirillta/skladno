import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { FactCheckView } from "./FactCheckView.js";

// product: history-and-publishing.fact-findings-advisory

const factCheck = { reviewedRevisionId: "revision-1", findings: [{ factId: "fact-1", occurrenceId: "revision-1:fact-1", claim: "A claim that needs evidence.", status: "disputed" as const, rationale: "The source contradicts the stated number.", uncertainty: "Medium", sources: [{ url: "https://example.com/source", title: "Primary source", quality: "primary" as const, publishedAt: "2026-01-01" }] }] };

describe("FactCheckView", () => {
    it("keeps stale findings readable but blocks correction selection", async () => {
        const user = userEvent.setup();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={factCheck} stale runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getAllByText("A claim that needs evidence.")).toHaveLength(2);
        expect(screen.getByRole("link", { name: /Primary source/ }).getAttribute("target")).toBe("_blank");
        expect(screen.queryByRole("button", { name: /Propose corrections/ })).toBeNull();
        await user.click(screen.getByRole("button", { name: "Run Fact Check again" }));
    });
});
