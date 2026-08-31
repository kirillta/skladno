import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { defaultGeneralSettings } from "@skladno/shared";
import { messages } from "../../../i18n/messages.js";
import { message } from "../../../i18n/test-message.js";
import { AssistantTimeline } from "./AssistantTimeline.js";


describe("AssistantTimeline", () => {
    it("shows persisted Fact Check claims in their Findings prepared message", () => {
        render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} assistantMessages={[{ id: "findings", articleId: "article", role: "assistant", kind: "response", status: "completed", responseKind: "findings_prepared", createdAt: "2026-08-13T20:30:00.000Z", updatedAt: "2026-08-13T20:30:00.000Z" }]} factCheckClaims={[{ claim: "HTTP was standardized in 1999.", checked: true }]} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);

        expect(screen.getByRole("region", { name: message("assistant.factCheckClaimsChecked") })).toBeTruthy();
        expect(screen.getByText("HTTP was standardized in 1999.")).toBeTruthy();
    });


    it("keeps human-readable activity secondary while a request streams", () => {
        render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="streaming" message="" activity={{ summary: "Checking facts.", status: "started" }} collapsed={false} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);

        expect(screen.getByRole("status").textContent).toContain("Checking facts.");
        expect(screen.queryByText("Working for 1 second")).toBeNull();
    });
});
