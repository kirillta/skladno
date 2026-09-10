import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";
import { resetApplicationSettingsTestEnvironment, settingsSnapshot } from "./ApplicationSettings.test-utils.js";


// Product scenario: settings.general-time-zone-preferences

describe("ApplicationSettings general", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    it("provides a compact section selector", async () => {
        const user = userEvent.setup();
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await user.selectOptions(await screen.findByRole("combobox", { name: message("settings.navigation") }), "about");
        expect(screen.getByRole("heading", { name: message("settings.about") })).toBeTruthy();
        expect(screen.getByText(message("settings.aboutDescription"))).toBeTruthy();
        expect(screen.getByRole("link", { name: message("settings.sourceCode") }).getAttribute("href")).toBe("https://github.com/kirillta/skladno");
    });

    it("persists the Editorial Assistant send-key preference", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), updateGeneralSettings, getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await user.click(await screen.findByRole("button", { name: message("settings.keyBindings") }));
        await user.selectOptions(screen.getByRole("combobox", { name: message("settings.assistantSendMode") }), "ctrl-enter");
        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({ ...defaultGeneralSettings, assistantSendMode: "ctrl-enter" }));
    });

    it("persists an accessible explicit time-zone selection and previews it", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), updateGeneralSettings, getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        const heading = await screen.findByText("Time zone");
        const select = heading.closest("section")?.querySelector("select") as HTMLSelectElement;
        expect(screen.getByRole("heading", { name: "Date & time" })).toBeTruthy();
        expect(select).toBeTruthy();
        expect(select.getAttribute("aria-describedby")).toBeTruthy();
        expect([...select.options].map((option) => option.value)).toContain("UTC");
        expect([...select.options].find((option) => option.value === "America/Buenos_Aires")?.textContent).toMatch(/^\(UTC[+-]\d{2}:\d{2}\) Buenos Aires$/);
        expect(screen.getByText(/Example:/)).toBeTruthy();
        await user.selectOptions(select, "America/Buenos_Aires");
        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({ ...defaultGeneralSettings, timeZone: "America/Buenos_Aires" }));
        await user.click(screen.getByRole("button", { name: message("settings.resetTimeZone") }));
        await waitFor(() => expect(updateGeneralSettings).toHaveBeenLastCalledWith(defaultGeneralSettings));
    });

    it("offers system and explicit date formats and resets only the date preference", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), updateGeneralSettings, getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        const heading = await screen.findByText("Date format");
        const select = heading.closest("section")?.querySelector("select") as HTMLSelectElement;
        expect(select.getAttribute("aria-describedby")).toBeTruthy();
        expect([...select.options].map((option) => option.value)).toEqual(["system", "day-first", "day-first-dots", "month-first", "iso"]);
        expect(select.options[0]?.textContent).toMatch(/^System date format \(.+\)$/);
        await user.selectOptions(select, "day-first-dots");
        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({ ...defaultGeneralSettings, dateFormat: "day-first-dots" }));
        const reset = screen.getByRole("button", { name: message("settings.resetDateFormat") });
        expect((reset as HTMLButtonElement).disabled).toBe(false);
        await user.click(reset);
        await waitFor(() => expect(updateGeneralSettings).toHaveBeenLastCalledWith(defaultGeneralSettings));
        expect((reset as HTMLButtonElement).disabled).toBe(true);
    });

    it("applies the selected appearance", async () => {
        const user = userEvent.setup();
        const general = { ...defaultGeneralSettings, theme: "dark" as const };
        const onThemeApplied = vi.fn();
        const client = { getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), general }), getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} onThemeApplied={onThemeApplied} /></NotificationProvider></IntlProvider>);
        await screen.findByText("Preferred appearance");
        await user.click(screen.getByRole("button", { name: message("settings.applyAppearance") }));
        expect(onThemeApplied).toHaveBeenCalledWith("dark");
    });

    it("marks the single supported interface language as unavailable", async () => {
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        const heading = await screen.findByText("Interface language");
        const select = heading.closest("section")?.querySelector("select") as HTMLSelectElement;
        expect(select.disabled).toBe(true);
        expect(select.getAttribute("aria-describedby")).toBeTruthy();
    });

    it("resets an explicit time format without changing date or time-zone preferences", async () => {
        const user = userEvent.setup();
        const general = { ...defaultGeneralSettings, dateFormat: "day-first-dots" as const, timeFormat: "24-hour" as const, timeZone: "America/Buenos_Aires" };
        const updateGeneralSettings = vi.fn().mockResolvedValue(general);
        const client = { getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), general }), updateGeneralSettings, getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await screen.findByText("Time format");
        await user.click(screen.getByRole("button", { name: message("settings.resetTimeFormat") }));
        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({ ...general, timeFormat: "system" }));
    });

    it("renders telemetry as an accessible switch and confirms its saved state", async () => {
        const user = userEvent.setup();
        const setTelemetryConsent = vi.fn().mockResolvedValue({ enabled: false, supported: true });
        window.skladnoTelemetry = { getTelemetryConsent: vi.fn().mockResolvedValue({ enabled: true, supported: true, installationId: "123e4567-e89b-42d3-a456-426614174000" }), setTelemetryConsent, beginTelemetryCapture: vi.fn(), captureTelemetry: vi.fn() };
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        const toggle = await screen.findByRole("switch", { name: message("settings.telemetry") });
        expect(toggle.getAttribute("aria-checked")).toBe("true");
        expect(screen.getByRole("button", { name: message("settings.copyTelemetryIdentifier") })).toBeTruthy();
        await user.click(toggle);
        await waitFor(() => expect(setTelemetryConsent).toHaveBeenCalledWith(false));
        expect(toggle.getAttribute("aria-checked")).toBe("false");
    });
});
