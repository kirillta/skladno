import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, type DesktopSettingsClient, type DesktopUpdateClient } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";
import { UpdatesSettingsGroup } from "./components/UpdatesSettingsGroup.js";
import { resetApplicationSettingsTestEnvironment, settingsSnapshot } from "./ApplicationSettings.test-utils.js";


// Product scenarios: settings.general-time-zone-preferences, settings.preview-update-controls

describe("ApplicationSettings general", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    it("provides a compact section selector", async () => {
        const user = userEvent.setup();
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.selectOptions(await screen.findByRole("combobox", { name: message("settings.navigation") }), "ai");

        expect(screen.getByRole("heading", { name: message("settings.ai") })).toBeTruthy();
    });


    it("shows update availability guidance in an Electron development build", async () => {
        window.skladnoDesktop = {} as DesktopSettingsClient;
        const setAutomaticChecks = vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: false, includePrereleases: false, networkAccess: true });
        const setNetworkAccess = vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: true, includePrereleases: false, networkAccess: true });
        window.skladnoUpdates = {
            getState: vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: true, includePrereleases: false, networkAccess: false }), setNetworkAccess, setAutomaticChecks, setIncludePrereleases: vi.fn(), checkNow: vi.fn(), download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined,
        };
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        expect(await screen.findByRole("heading", { name: message("settings.updates") })).toBeTruthy();
        expect(screen.getAllByText(message("settings.updatesUnavailable"))).toHaveLength(1);
        await userEvent.setup().click(screen.getByRole("switch", { name: message("settings.updateNetworkAccess") }));
        expect(setNetworkAccess).not.toHaveBeenCalled();
        await userEvent.setup().click(screen.getByRole("button", { name: message("settings.allowNetworkAccess") }));
        expect(setNetworkAccess).toHaveBeenCalledWith(true);
        await userEvent.setup().click(screen.getByRole("switch", { name: message("settings.automaticUpdates") }));
        expect(setAutomaticChecks).toHaveBeenCalledWith(false);
    });


    // Product scenarios: settings.preview-update-controls
    it("keeps preview update download explicit in General Settings", async () => {
        const user = userEvent.setup();
        const checkNow = vi.fn().mockResolvedValue({ kind: "available", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1.security", title: "Security preview", summary: "Unsigned Windows preview", releaseNotesUrl: "https://example.test/release", security: true, automaticChecks: true, includePrereleases: true, networkAccess: true });
        const setNetworkAccess = vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: true, networkAccess: true });
        const setIncludePrereleases = vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: false, networkAccess: true });
        const updates: DesktopUpdateClient = {
            getState: vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: true, networkAccess: false }), setNetworkAccess, setAutomaticChecks: vi.fn(), setIncludePrereleases, checkNow, download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined,
        };
        render(<IntlProvider locale="en" messages={messages}><UpdatesSettingsGroup client={updates} desktop /></IntlProvider>);

        expect((await screen.findByRole("switch", { name: message("settings.updateNetworkAccess") })).getAttribute("aria-checked")).toBe("false");
        expect(screen.queryByRole("button", { name: message("settings.downloadUpdate") })).toBeNull();
        await user.click(screen.getByRole("switch", { name: message("settings.updateNetworkAccess") }));
        expect(setNetworkAccess).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog", { name: message("settings.updateNetworkPermissionTitle") })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: message("settings.allowNetworkAccess") }));
        expect(setNetworkAccess).toHaveBeenCalledWith(true);
        await user.click(screen.getByRole("switch", { name: message("settings.includePrereleaseUpdates") }));
        expect(setIncludePrereleases).toHaveBeenCalledWith(false);
        await user.click(screen.getByRole("button", { name: message("settings.checkNow") }));
        await screen.findByRole("button", { name: message("settings.downloadUpdate") });
        expect(checkNow).toHaveBeenCalledOnce();
        expect(screen.queryByText("Unsigned Windows preview")).toBeNull();
        expect(screen.queryByText("Skladno checks public release metadata.")).toBeNull();
        expect(screen.getByRole("button", { name: message("settings.viewReleaseNotes") }).classList.contains("bg-transparent")).toBe(true);
    });


    it("persists the Editorial Assistant send-key preference", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            updateGeneralSettings,
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.keyBindings") }));
        await user.selectOptions(screen.getByRole("combobox", { name: message("settings.assistantSendMode") }), "ctrl-enter");

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...defaultGeneralSettings,
            assistantSendMode: "ctrl-enter",
        }));
    });


    it("persists an accessible explicit time-zone selection and previews it", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            updateGeneralSettings,
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

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

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...defaultGeneralSettings,
            timeZone: "America/Buenos_Aires",
        }));

        await user.click(screen.getByRole("button", { name: message("settings.resetTimeZone") }));

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenLastCalledWith(defaultGeneralSettings));
    });


    it("offers system and explicit date formats and resets only the date preference", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            updateGeneralSettings,
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        const heading = await screen.findByText("Date format");
        const select = heading.closest("section")?.querySelector("select") as HTMLSelectElement;

        expect(select.getAttribute("aria-describedby")).toBeTruthy();
        expect([...select.options].map((option) => option.value)).toEqual(["system", "day-first", "day-first-dots", "month-first", "iso"]);
        expect(select.options[0]?.textContent).toMatch(/^System date format \(.+\)$/);

        await user.selectOptions(select, "day-first-dots");

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...defaultGeneralSettings,
            dateFormat: "day-first-dots",
        }));

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
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), general }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} onThemeApplied={onThemeApplied} /></NotificationProvider></IntlProvider>);

        await screen.findByText("Preferred appearance");
        await user.click(screen.getByRole("button", { name: message("settings.applyAppearance") }));

        expect(onThemeApplied).toHaveBeenCalledWith("dark");
    });


    it("marks the single supported interface language as unavailable", async () => {
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        const heading = await screen.findByText("Interface language");
        const select = heading.closest("section")?.querySelector("select") as HTMLSelectElement;

        expect(select.disabled).toBe(true);
        expect(select.getAttribute("aria-describedby")).toBeTruthy();
    });


    it("resets an explicit time format without changing date or time-zone preferences", async () => {
        const user = userEvent.setup();
        const general = {
            ...defaultGeneralSettings,
            dateFormat: "day-first-dots" as const,
            timeFormat: "24-hour" as const,
            timeZone: "America/Buenos_Aires",
        };
        const updateGeneralSettings = vi.fn().mockResolvedValue(general);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), general }),
            updateGeneralSettings,
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await screen.findByText("Time format");
        await user.click(screen.getByRole("button", { name: message("settings.resetTimeFormat") }));

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...general,
            timeFormat: "system",
        }));
    });

});
