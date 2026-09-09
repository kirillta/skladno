import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopSettingsClient } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";
import { resetApplicationSettingsTestEnvironment, settingsSnapshot } from "./ApplicationSettings.test-utils.js";

describe("ApplicationSettings AI", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    // Product scenarios: settings.ai-connection-lifecycle
    it("allows entering an environment-variable name for a new AI connection", async () => {
        const user = userEvent.setup();
        const addAiConnection = vi.fn().mockResolvedValue({
            id: "connection-1",
            provider: "openai",
            label: "Personal AI",
            environmentVariableName: "AI_API_KEY",
            status: "unchecked",
        });
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            addAiConnection,
            refreshAiModels: vi.fn().mockResolvedValue([]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        const connectionName = screen.getByPlaceholderText("For example, Personal AI");
        const environmentName = screen.getByPlaceholderText("For example, AI_API_KEY");

        expect(connectionName.hasAttribute("readonly")).toBe(false);
        expect(environmentName.hasAttribute("readonly")).toBe(false);

        await user.type(connectionName, "Personal AI");
        fireEvent.paste(environmentName, {
            clipboardData: {
                getData: () => "AI_API_KEY",
            },
        });
        await user.click(screen.getByRole("button", { name: message("settings.addConnectionButton") }));

        await waitFor(() => expect(addAiConnection).toHaveBeenCalledWith({
            provider: "openai",
            label: "Personal AI",
            environmentVariableName: "AI_API_KEY",
        }));
        expect((connectionName as HTMLInputElement).value).toBe("");
        expect((environmentName as HTMLInputElement).value).toBe("");
        expect(screen.getByText("Configured connections")).toBeTruthy();
        expect(screen.getAllByText("Personal AI")).toHaveLength(1);
        expect(screen.getByText("AI_API_KEY")).toBeTruthy();
    });

    it("allows another provider to use an existing environment-variable key", async () => {
        const user = userEvent.setup();
        const addAiConnection = vi.fn().mockResolvedValue({ id: "connection-2", provider: "opencode", label: "OpenCode Zen", credentialSource: { kind: "environment-variable" as const, environmentVariableName: "AI_API_KEY" }, status: "unchecked" as const });
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [{ id: "connection-1", provider: "openai" as const, label: "OpenAI", credentialSource: { kind: "environment-variable" as const, environmentVariableName: "AI_API_KEY" }, status: "connected" as const }] }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            addAiConnection,
            refreshAiModels: vi.fn().mockResolvedValue([]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.selectOptions(screen.getByRole("combobox", { name: message("settings.provider") }), "opencode");
        await user.type(screen.getByPlaceholderText("For example, Personal AI"), "OpenCode Zen");
        await user.type(screen.getByPlaceholderText("For example, AI_API_KEY"), "AI_API_KEY");
        await user.click(screen.getByRole("button", { name: message("settings.addConnectionButton") }));

        await waitFor(() => expect(addAiConnection).toHaveBeenCalledWith({ provider: "opencode", label: "OpenCode Zen", environmentVariableName: "AI_API_KEY" }));
    });

    it("adds an API key through the desktop credential client without rendering it again", async () => {
        const user = userEvent.setup();
        const addManagedAiConnection = vi.fn().mockResolvedValue({ id: "connection-1", provider: "openai", label: "Personal AI", credentialSource: { kind: "managed" as const }, status: "connected" as const });
        const desktop: DesktopSettingsClient = {
            getLocations: vi.fn().mockResolvedValue({ dataDirectory: "", dataDirectoryExternallyControlled: false }),
            chooseBackupDirectory: vi.fn(),
            revealBackupDirectory: vi.fn(),
            revealDataDirectory: vi.fn(),
            createNativeBackup: vi.fn(),
            restoreNativeBackup: vi.fn(),
            deleteLocalData: vi.fn(),
            addManagedAiConnection,
            renameManagedAiConnection: vi.fn(),
            removeManagedAiConnection: vi.fn(),
        };
        window.skladnoDesktop = desktop;
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue([]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        expect(screen.queryByPlaceholderText("Paste your API key")).toBeNull();
        expect(screen.queryByPlaceholderText("For example, AI_API_KEY")).toBeNull();
        expect(screen.queryByRole("combobox", { name: message("settings.provider") })).toBeNull();
        await user.click(screen.getByRole("button", { name: message("settings.apiKey") }));
        expect(screen.getByRole("combobox", { name: message("settings.provider") })).toBeTruthy();
        await user.type(screen.getByPlaceholderText("For example, Personal AI"), "Personal AI");
        await user.type(screen.getByPlaceholderText("Paste your API key"), "<REDACTED>");
        await user.click(screen.getByRole("button", { name: message("settings.addApiKeyButton") }));

        await waitFor(() => expect(addManagedAiConnection).toHaveBeenCalledWith({ provider: "openai", label: "Personal AI", apiKey: "<REDACTED>" }));
        expect(screen.queryByDisplayValue("<REDACTED>")).toBeNull();
    });

    it("uses the selected provider and labels saved connections", async () => {
        const user = userEvent.setup();
        const addAiConnection = vi.fn().mockResolvedValue({ id: "connection-1", provider: "anthropic", label: "Personal Claude", credentialSource: { kind: "environment-variable" as const, environmentVariableName: "ANTHROPIC_API_KEY" }, status: "connected" as const });
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [{ id: "existing", provider: "deepseek", label: "DeepSeek", credentialSource: { kind: "managed" as const }, status: "connected" as const }] }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            addAiConnection,
            refreshAiModels: vi.fn().mockResolvedValue([]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        expect(screen.getAllByText("DeepSeek")).not.toHaveLength(0);
        await user.selectOptions(screen.getByRole("combobox", { name: message("settings.provider") }), "anthropic");
        await user.type(screen.getByPlaceholderText("For example, Personal AI"), "Personal Claude");
        await user.type(screen.getByPlaceholderText("For example, AI_API_KEY"), "ANTHROPIC_API_KEY");
        await user.click(screen.getByRole("button", { name: message("settings.addConnectionButton") }));

        await waitFor(() => expect(addAiConnection).toHaveBeenCalledWith({ provider: "anthropic", label: "Personal Claude", environmentVariableName: "ANTHROPIC_API_KEY" }));
        expect(screen.getByText(message("settings.providerLimitations"))).toBeTruthy();
    });

    it("renames a managed connection through the desktop credential client", async () => {
        const user = userEvent.setup();
        const connection = { id: "connection-1", provider: "openai", label: "Personal AI", credentialSource: { kind: "managed" as const }, status: "connected" as const };
        const renameManagedAiConnection = vi.fn().mockResolvedValue({ ...connection, label: "Work AI" });
        const desktop: DesktopSettingsClient = {
            getLocations: vi.fn().mockResolvedValue({ dataDirectory: "", dataDirectoryExternallyControlled: false }),
            chooseBackupDirectory: vi.fn(), revealBackupDirectory: vi.fn(), revealDataDirectory: vi.fn(), createNativeBackup: vi.fn(), restoreNativeBackup: vi.fn(), deleteLocalData: vi.fn(), addManagedAiConnection: vi.fn(), renameManagedAiConnection, removeManagedAiConnection: vi.fn(),
        };
        window.skladnoDesktop = desktop;
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue([]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.click(screen.getByRole("button", { name: message("settings.renameConnectionShort") }));
        const input = screen.getByRole("textbox", { name: message("settings.connectionName") });
        await user.clear(input);
        await user.type(input, "Work AI");
        await user.click(screen.getByRole("button", { name: message("settings.saveConnectionName") }));

        await waitFor(() => expect(renameManagedAiConnection).toHaveBeenCalledWith(connection.id, "Work AI"));
        expect(screen.getByText("Work AI")).toBeTruthy();
    });

    it("renames an environment-variable connection without changing its variable name", async () => {
        const user = userEvent.setup();
        const connection = { id: "connection-1", provider: "openai", label: "Personal AI", credentialSource: { kind: "environment-variable" as const, environmentVariableName: "AI_API_KEY" }, status: "connected" as const };
        const updateAiConnection = vi.fn().mockResolvedValue({ ...connection, label: "Work AI" });
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue([]),
            updateAiConnection,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.click(screen.getByRole("button", { name: message("settings.renameConnectionShort") }));
        const input = screen.getByRole("textbox", { name: message("settings.connectionName") });
        await user.clear(input);
        await user.type(input, "Work AI");
        await user.click(screen.getByRole("button", { name: message("settings.saveConnectionName") }));

        await waitFor(() => expect(updateAiConnection).toHaveBeenCalledWith(connection.id, { label: "Work AI", environmentVariableName: "AI_API_KEY" }));
        expect(screen.getByText("Work AI")).toBeTruthy();
    });

});
