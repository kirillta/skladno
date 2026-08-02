import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";


function settingsSnapshot(): ApplicationSettingsSnapshot {
    return {
        general: defaultGeneralSettings,
        connections: [],
        modelPreferences: { defaultModel: "", operationOverrides: {} },
        backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } },
        keyBindingOverrides: {},
    };
}


describe("ApplicationSettings", () => {
    afterEach(cleanup);


    it("persists an accessible explicit time-zone selection and previews it", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            updateGeneralSettings,
            getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        const heading = await screen.findByText("Time zone");
        const select = heading.parentElement?.querySelector("select") as HTMLSelectElement;

        expect(select).toBeTruthy();
        expect(select.getAttribute("aria-describedby")).toBeTruthy();
        expect([...select.options].map((option) => option.value)).toContain("UTC");
        expect([...select.options].find((option) => option.value === "America/Buenos_Aires")?.textContent).toMatch(/^\(UTC[+-]\d{2}:\d{2}\) Buenos Aires$/);
        expect(screen.getByText(/Example:/)).toBeTruthy();

        await user.selectOptions(select, "America/Buenos_Aires");

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...defaultGeneralSettings,
            timeZone: "America/Buenos_Aires",
        }));

        await user.click(screen.getByRole("button", { name: "Use system time zone" }));

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenLastCalledWith(defaultGeneralSettings));
    });
});
