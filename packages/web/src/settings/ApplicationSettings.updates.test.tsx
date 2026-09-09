import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopSettingsClient, DesktopUpdateClient } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";
import { UpdatesSettingsGroup } from "./components/UpdatesSettingsGroup.js";
import { resetApplicationSettingsTestEnvironment, settingsSnapshot } from "./ApplicationSettings.test-utils.js";


// Product scenario: settings.preview-update-controls

describe("ApplicationSettings updates", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    it("shows update availability guidance in an Electron development build", async () => {
        window.skladnoDesktop = {} as DesktopSettingsClient;
        const setAutomaticChecks = vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: false, includePrereleases: false, networkAccess: true });
        const setNetworkAccess = vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: true, includePrereleases: false, networkAccess: true });
        window.skladnoUpdates = { getState: vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: true, includePrereleases: false, networkAccess: false }), setNetworkAccess, setAutomaticChecks, setIncludePrereleases: vi.fn(), checkNow: vi.fn(), download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined };
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await userEvent.setup().click(await screen.findByRole("button", { name: message("settings.about") }));
        expect(await screen.findByRole("heading", { name: message("settings.updates") })).toBeTruthy();
        expect(screen.getAllByText(message("settings.updatesUnavailable"))).toHaveLength(1);
        await userEvent.setup().click(screen.getByRole("switch", { name: message("settings.updateNetworkAccess") }));
        expect(setNetworkAccess).not.toHaveBeenCalled();
        await userEvent.setup().click(screen.getByRole("button", { name: message("settings.allowNetworkAccess") }));
        expect(setNetworkAccess).toHaveBeenCalledWith(true);
        await userEvent.setup().click(screen.getByRole("switch", { name: message("settings.automaticUpdates") }));
        expect(setAutomaticChecks).toHaveBeenCalledWith(false);
    });

    it("opens About and focuses Updates when requested", async () => {
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} focusUpdates /></NotificationProvider></IntlProvider>);
        await screen.findByRole("heading", { name: message("settings.about") });
        await waitFor(() => expect(document.activeElement).toBe(document.getElementById("settings-updates")));
    });

    it("keeps preview update download explicit in About", async () => {
        const user = userEvent.setup();
        const checkNow = vi.fn().mockResolvedValue({ kind: "available", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1.security", title: "Security preview", summary: "Unsigned Windows preview", releaseNotesUrl: "https://example.test/release", security: true, automaticChecks: true, includePrereleases: true, networkAccess: true });
        const setNetworkAccess = vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: true, networkAccess: true });
        const setIncludePrereleases = vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: false, networkAccess: true });
        const updates: DesktopUpdateClient = { getState: vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: true, networkAccess: false }), setNetworkAccess, setAutomaticChecks: vi.fn(), setIncludePrereleases, checkNow, download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined };
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

    it("shows when an update is downloading", async () => {
        const updates: DesktopUpdateClient = { getState: vi.fn().mockResolvedValue({ kind: "downloading", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1", title: "Preview", summary: "", releaseNotesUrl: "https://example.test/release", security: false, automaticChecks: true, includePrereleases: true, networkAccess: true }), setNetworkAccess: vi.fn(), setAutomaticChecks: vi.fn(), setIncludePrereleases: vi.fn(), checkNow: vi.fn(), download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined };
        render(<IntlProvider locale="en" messages={messages}><UpdatesSettingsGroup client={updates} desktop /></IntlProvider>);
        expect(await screen.findByText(message("status.updateDownloading"))).toBeTruthy();
    });
});
