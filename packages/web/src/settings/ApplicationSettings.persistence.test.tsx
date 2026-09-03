import { render, screen, waitFor, within } from "@testing-library/react";
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
import { saveWebBackup } from "./web-backups.js";


vi.mock("./web-backups.js", () => ({
    chooseBackupFolder: vi.fn().mockResolvedValue("Skladno backups"),
    saveWebBackup: vi.fn().mockResolvedValue("skladno-manual.sqlite"),
    saveScheduledWebBackup: vi.fn(),
    selectedBackupFolderName: vi.fn().mockResolvedValue(undefined),
}));


// Product scenarios: settings.backup-policy-human-reviewed

describe("ApplicationSettings persistence", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    it("keeps Article and translation language defaults together in Publishing Settings", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            updateGeneralSettings,
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.publishing") }));
        const languages = screen.getByRole("group", { name: message("settings.defaultTranslationLanguages") });
        expect(languages.getAttribute("aria-describedby")).toBeTruthy();

        await user.click(screen.getByRole("checkbox", { name: message("languages.spanish") }));
        await user.click(screen.getByRole("checkbox", { name: message("languages.german") }));

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...defaultGeneralSettings,
            defaultTranslationLanguages: ["es", "de"],
        }));
    });


    // product: settings.backup-policy-human-reviewed
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

        await screen.findByText("Couldn’t create a backup. Your editing session is still safe.");
        expect(screen.getByRole("button", { name: message("settings.createBackup") }).hasAttribute("disabled")).toBe(false);
        expect(screen.getByRole("button", { name: message("settings.publishing") }).hasAttribute("disabled")).toBe(false);
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

    it("retains an editable custom profile until the author saves its name and limit", async () => {
        const user = userEvent.setup();
        const settings = { defaultProfileId: "default" as const, customProfiles: [] };
        const setPublishingSettings = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue(settings),
            setPublishingSettings,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.publishing") }));
        await user.clear(screen.getByRole("textbox", { name: message("settings.customProfileName") }));
        await user.type(screen.getByRole("textbox", { name: message("settings.customProfileName") }), "Newsletter");
        const limit = screen.getByRole("spinbutton", { name: message("settings.customProfileLimit") });
        await user.clear(limit);
        await user.type(limit, "1200");
        await user.click(screen.getByRole("button", { name: message("settings.saveCustomProfile") }));

        await waitFor(() => expect(setPublishingSettings).toHaveBeenCalledWith(expect.objectContaining({ customProfiles: [expect.objectContaining({ name: "Newsletter", characterLimit: 1200 })] })));
        await user.type(screen.getByRole("textbox", { name: message("settings.customProfileName") }), "Long read");
        await user.type(screen.getByRole("spinbutton", { name: message("settings.customProfileLimit") }), "5000");
        await user.click(screen.getByRole("button", { name: message("settings.saveCustomProfile") }));

        await waitFor(() => expect(setPublishingSettings).toHaveBeenLastCalledWith(expect.objectContaining({ customProfiles: [expect.objectContaining({ name: "Newsletter", characterLimit: 1200 }), expect.objectContaining({ name: "Long read", characterLimit: 5000 })] })));
        await user.click(screen.getByRole("button", { name: message("settings.removeCustomProfile", { name: "Newsletter" }) }));
        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: message("settings.remove") }));

        await waitFor(() => expect(setPublishingSettings).toHaveBeenLastCalledWith(expect.objectContaining({ customProfiles: [expect.objectContaining({ name: "Long read", characterLimit: 5000 })] })));
    });

    it("prevents duplicate environment-variable names and manages saved connections", async () => {
        const user = userEvent.setup();
        const firstConnection = { id: "connection-1", provider: "openai" as const, label: "Personal AI", environmentVariableName: "AI_API_KEY", status: "unchecked" as const };
        const secondConnection = { id: "connection-2", provider: "openai" as const, label: "Work AI", environmentVariableName: "WORK_AI_API_KEY", status: "unchecked" as const };
        const setActiveAiConnection = vi.fn().mockResolvedValue(undefined);
        const removeAiConnection = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [firstConnection, secondConnection], activeConnectionId: firstConnection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            addAiConnection: vi.fn(),
            setActiveAiConnection,
            removeAiConnection,
            refreshAiModels: vi.fn().mockResolvedValue([]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await waitFor(() => expect(client.refreshAiModels).toHaveBeenCalledOnce());
        await user.type(screen.getByPlaceholderText("For example, AI_API_KEY"), "AI_API_KEY");
        await user.click(screen.getByRole("button", { name: message("settings.addConnectionButton") }));

        expect(screen.getByRole("alert").textContent).toContain("already saved");
        expect(client.addAiConnection).not.toHaveBeenCalled();
        expect(screen.getAllByRole("button", { name: message("settings.removeConnectionShort") })).toHaveLength(1);

        await user.click(screen.getByRole("button", { name: message("settings.useConnectionShort") }));
        await waitFor(() => expect(setActiveAiConnection).toHaveBeenCalledWith(secondConnection.id));
        await waitFor(() => expect(client.refreshAiModels).toHaveBeenCalledTimes(2));

        await user.click(screen.getAllByRole("button", { name: message("settings.removeConnectionShort") })[0]!);
        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: message("settings.removeConnection") }));

        await waitFor(() => expect(removeAiConnection).toHaveBeenCalledWith(firstConnection.id));
        expect(screen.queryByText("Personal OpenAI")).toBeNull();
    });
});
