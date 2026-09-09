import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";
import { resetApplicationSettingsTestEnvironment, settingsSnapshot } from "./ApplicationSettings.test-utils.js";
import { saveWebBackup } from "./web-backups.js";

vi.mock("./web-backups.js", () => ({
    chooseBackupFolder: vi.fn().mockResolvedValue("Skladno backups"),
    saveWebBackup: vi.fn().mockResolvedValue("skladno-manual.sqlite"),
    listWebBackups: vi.fn().mockResolvedValue(["skladno-manual.sqlite"]),
    restoreWebBackup: vi.fn().mockResolvedValue(undefined),
    webBackupErrorMessageId: vi.fn((_error, fallback) => fallback),
    saveScheduledWebBackup: vi.fn(),
    selectedBackupFolderName: vi.fn().mockResolvedValue(undefined),
}));


// Product scenarios: settings.backup-policy-human-reviewed

describe("ApplicationSettings backups", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    it("chooses a browser backup folder and creates a manual backup", async () => {
        const user = userEvent.setup();
        const backupPolicy = { schedule: "daily" as const, retention: { mode: "count" as const, count: 7 } };
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), backupPolicy }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            createBackup: vi.fn().mockResolvedValue(new Blob()),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await user.click(await screen.findByRole("button", { name: message("settings.dataBackups") }));
        await user.click(screen.getByRole("button", { name: message("settings.chooseBackupFolder") }));
        await screen.findByText("Using Skladno backups");
        await user.click(screen.getByRole("button", { name: message("settings.createBackup") }));
        await waitFor(() => expect(screen.getByText("Created skladno-manual.sqlite")).toBeTruthy());
    });

    it("reports a backup failure without blocking Settings", async () => {
        const user = userEvent.setup();
        vi.mocked(saveWebBackup).mockRejectedValueOnce(new Error("write failed"));
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await user.click(await screen.findByRole("button", { name: message("settings.dataBackups") }));
        await user.click(screen.getByRole("button", { name: message("settings.chooseBackupFolder") }));
        await user.click(screen.getByRole("button", { name: message("settings.createBackup") }));
        await screen.findByText(message("settings.backupCreateFailed"));
        expect(screen.getByRole("button", { name: message("settings.createBackup") }).hasAttribute("disabled")).toBe(false);
        expect(screen.getByRole("button", { name: message("settings.publishing") }).hasAttribute("disabled")).toBe(false);
    });

    it("offers snapshots from the selected browser backup folder", async () => {
        const user = userEvent.setup();
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await user.click(await screen.findByRole("button", { name: message("settings.dataBackups") }));
        await user.click(screen.getByRole("button", { name: message("settings.chooseBackupFolder") }));
        const restore = await screen.findByRole("combobox", { name: message("settings.restoreBackup") });
        expect(within(restore).getByRole("option", { name: "skladno-manual.sqlite" })).toBeTruthy();
    });

    it("toggles automatic backups", async () => {
        const user = userEvent.setup();
        const updateBackupPolicy = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            updateBackupPolicy,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await user.click(await screen.findByRole("button", { name: message("settings.dataBackups") }));
        const toggle = screen.getByRole("switch", { name: message("settings.automaticBackups") });
        expect(toggle.getAttribute("aria-checked")).toBe("false");
        await user.click(toggle);
        await waitFor(() => expect(updateBackupPolicy).toHaveBeenCalledWith(expect.objectContaining({ schedule: "daily" })));
        expect(toggle.getAttribute("aria-checked")).toBe("true");
    });
});
