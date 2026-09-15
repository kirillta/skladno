import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopSettingsClient, DesktopUpdateClient } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../application/client.js";
import { messages } from "../i18n/messages.js";
import { getMessage } from "../i18n/test-message.js";
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
        await userEvent.setup().click(await screen.findByRole("button", { name: getMessage("settings.about") }));
        expect(await screen.findByRole("heading", { name: getMessage("settings.updates") })).toBeTruthy();
        expect(screen.getAllByText(getMessage("settings.updatesUnavailable"))).toHaveLength(1);
        await userEvent.setup().click(screen.getByRole("switch", { name: getMessage("settings.updateNetworkAccess") }));
        expect(setNetworkAccess).not.toHaveBeenCalled();
        await userEvent.setup().click(screen.getByRole("button", { name: getMessage("settings.allowNetworkAccess") }));
        expect(setNetworkAccess).toHaveBeenCalledWith(true);
        await userEvent.setup().click(screen.getByRole("switch", { name: getMessage("settings.automaticUpdates") }));
        expect(setAutomaticChecks).toHaveBeenCalledWith(false);
    });

    it("opens About and focuses Updates when requested", async () => {
        const client = { getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()), getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }) } as unknown as EditorialWorkspaceClient;
        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} focusUpdates /></NotificationProvider></IntlProvider>);
        await screen.findByRole("heading", { name: getMessage("settings.about") });
        await waitFor(() => expect(document.activeElement).toBe(document.getElementById("settings-updates")));
    });

    it("keeps preview update download explicit in About", async () => {
        const user = userEvent.setup();
        const checkNow = vi.fn().mockResolvedValue({ kind: "available", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1.security", title: "Security preview", summary: "Unsigned Windows preview", releaseNotesUrl: "https://example.test/release", security: true, automaticChecks: true, includePrereleases: true, networkAccess: true });
        const setNetworkAccess = vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: true, networkAccess: true });
        const setIncludePrereleases = vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: false, networkAccess: true });
        const updates: DesktopUpdateClient = { getState: vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true, includePrereleases: true, networkAccess: false }), setNetworkAccess, setAutomaticChecks: vi.fn(), setIncludePrereleases, checkNow, download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined };
        render(<IntlProvider locale="en" messages={messages}><UpdatesSettingsGroup client={updates} desktop /></IntlProvider>);
        expect((await screen.findByRole("switch", { name: getMessage("settings.updateNetworkAccess") })).getAttribute("aria-checked")).toBe("false");
        expect(screen.queryByRole("button", { name: getMessage("settings.downloadUpdate") })).toBeNull();
        await user.click(screen.getByRole("switch", { name: getMessage("settings.updateNetworkAccess") }));
        expect(setNetworkAccess).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog", { name: getMessage("settings.updateNetworkPermissionTitle") })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: getMessage("settings.allowNetworkAccess") }));
        expect(setNetworkAccess).toHaveBeenCalledWith(true);
        await user.click(screen.getByRole("switch", { name: getMessage("settings.includePrereleaseUpdates") }));
        expect(setIncludePrereleases).toHaveBeenCalledWith(false);
        await user.click(screen.getByRole("button", { name: getMessage("settings.checkNow") }));
        await screen.findByRole("button", { name: getMessage("settings.downloadUpdate") });
        expect(checkNow).toHaveBeenCalledOnce();
        expect(screen.queryByText("Unsigned Windows preview")).toBeNull();
        expect(screen.queryByText("Skladno checks public release metadata.")).toBeNull();
        expect(screen.getByRole("button", { name: getMessage("settings.viewReleaseNotes") }).classList.contains("bg-transparent")).toBe(true);
    });

    it("keeps visible activity while an update is downloading", async () => {
        const available = { kind: "available", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1", title: "Preview", summary: "", releaseNotesUrl: "https://example.test/release", security: false, automaticChecks: true, includePrereleases: true, networkAccess: true } as const;
        const downloading = { kind: "downloading", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1", title: "Preview", summary: "", releaseNotesUrl: "https://example.test/release", security: false, automaticChecks: true, includePrereleases: true, networkAccess: true } as const;
        const updates: DesktopUpdateClient = { getState: vi.fn().mockResolvedValue(available), setNetworkAccess: vi.fn(), setAutomaticChecks: vi.fn(), setIncludePrereleases: vi.fn(), checkNow: vi.fn(), download: vi.fn().mockResolvedValue(downloading), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined };
        render(<IntlProvider locale="en" messages={messages}><UpdatesSettingsGroup client={updates} desktop /></IntlProvider>);
        await userEvent.setup().click(await screen.findByRole("button", { name: getMessage("settings.downloadUpdate") }));
        expect((await screen.findByRole("button", { name: getMessage("status.updateDownloading") })).getAttribute("aria-busy")).toBe("true");
        expect(screen.queryByRole("button", { name: getMessage("settings.checkNow") })).toBeNull();
    });
});
