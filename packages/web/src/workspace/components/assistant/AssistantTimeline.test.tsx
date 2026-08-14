import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { defaultGeneralSettings } from "@skladno/shared";
import { messages } from "../../../i18n/messages.js";
import { AssistantTimeline } from "./AssistantTimeline.js";


describe("AssistantTimeline", () => {
    it("retains Fact Check claims after research completes", () => {
        render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} assistantMessages={[]} factCheckClaims={[{ claim: "HTTP was standardized in 1999.", checked: true }]} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);

        expect(screen.getByRole("region", { name: "Claims checked" })).toBeTruthy();
        expect(screen.getByText("HTTP was standardized in 1999.")).toBeTruthy();
    });
});
