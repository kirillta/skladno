import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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


// Product scenarios: settings.ai-connection-lifecycle, settings.available-model-list

describe("ApplicationSettings AI", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

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
        await user.click(screen.getByRole("button", { name: message("settings.apiKey") }));
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
            chooseBackupDirectory: vi.fn(), revealBackupDirectory: vi.fn(), revealDataDirectory: vi.fn(), createNativeBackup: vi.fn(), deleteLocalData: vi.fn(), addManagedAiConnection: vi.fn(), renameManagedAiConnection, removeManagedAiConnection: vi.fn(),
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

    it("loads available models when AI Settings opens", async () => {
        const user = userEvent.setup();
        const connection = { id: "connection-1", provider: "openai" as const, label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY", status: "connected" as const };
        const refreshAiModels = vi.fn().mockResolvedValue(["gpt-5"]);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));

        await waitFor(() => expect(refreshAiModels).toHaveBeenCalledOnce());
        await user.click(screen.getByRole("button", { name: message("settings.model") }));
        expect(screen.getAllByRole("option", { name: "GPT-5" })).not.toHaveLength(0);
    });

    it("saves reasoning effort for an OpenAI default model", async () => {
        const user = userEvent.setup();
        const connection = { id: "connection-1", provider: "openai" as const, label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY", status: "connected" as const };
        const updateModelPreferences = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id, modelPreferences: { defaultModel: "gpt-4.1", skillOverrides: {} } }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue(["gpt-5.5"]),
            updateModelPreferences,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.selectOptions(screen.getByRole("combobox", { name: message("settings.reasoningEffort") }), "high");

        await waitFor(() => expect(updateModelPreferences).toHaveBeenCalledWith({ defaultModel: "gpt-4.1", skillOverrides: {}, reasoningEffort: "high" }));
    });

    it("saves reasoning effort for supporting text and task overrides", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
        HTMLElement.prototype.scrollIntoView = vi.fn();
        const connection = { id: "connection-1", provider: "openai" as const, label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY", status: "connected" as const };
        const updateModelPreferences = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id, modelPreferences: { defaultModel: "gpt-5.5", textGenerationModel: "gpt-5.5-mini", skillOverrides: { talking_points: "gpt-5.5-mini" } } }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue(["gpt-5.5", "gpt-5.5-mini"]),
            updateModelPreferences,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.selectOptions(screen.getAllByRole("combobox", { name: message("settings.reasoningEffort") })[1]!, "low");
        await waitFor(() => expect(updateModelPreferences).toHaveBeenCalledWith(expect.objectContaining({ textGenerationReasoningEffort: "low" })));

        await user.click(screen.getByRole("button", { name: message("settings.specificModels") }));
        expect(screen.getAllByRole("combobox", { name: message("settings.reasoningEffort") })).toHaveLength(3);
        expect(document.getElementById("specific-model-overrides")?.firstElementChild?.classList.contains("overflow-visible")).toBe(true);
        await user.selectOptions(screen.getAllByRole("combobox", { name: message("settings.reasoningEffort") })[2]!, "high");
        await waitFor(() => expect(updateModelPreferences).toHaveBeenCalledWith(expect.objectContaining({ skillReasoningEfforts: { talking_points: "high" } })));
    });

    it("filters models by vendor and saves favorites", async () => {
        const user = userEvent.setup();
        const connection = { id: "connection-1", provider: "openai" as const, label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY", status: "connected" as const };
        const updateModelPreferences = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue(["gpt-5", "gpt-5-mini"]),
            updateModelPreferences,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.click(screen.getByRole("button", { name: message("settings.model") }));
        const listbox = screen.getAllByRole("listbox", { name: message("settings.model") })[0]!;
        const modelPicker = listbox.closest("details")!;
        expect(within(listbox).queryByRole("option", { name: message("settings.chooseModel") })).toBeNull();
        expect(screen.queryByRole("tab", { name: "All models" })).toBeNull();
        const otherTab = within(modelPicker).getByRole("tab", { name: "Other" });
        await user.click(otherTab);
        expect(otherTab.getAttribute("aria-selected")).toBe("true");
        expect(within(listbox).queryByRole("option", { name: "GPT-5" })).toBeNull();
        await user.click(within(modelPicker).getByRole("tab", { name: "OpenAI" }));
        expect(within(listbox).getByRole("option", { name: "GPT-5 mini" })).toBeTruthy();
        const search = screen.getAllByRole("textbox", { name: message("settings.searchModels") })[0]!;
        await user.type(search, "gpt");
        expect(within(listbox).getByRole("option", { name: "GPT-5" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: message("settings.clearModelSearch") }));
        expect(search.getAttribute("value")).toBe("");
        await user.type(search, "mini");
        await user.click(within(listbox).getByRole("button", { name: message("settings.addFavoriteModel", { model: "GPT-5 mini" }) }));

        await waitFor(() => expect(updateModelPreferences).toHaveBeenCalledWith(expect.objectContaining({ favoriteModels: ["gpt-5-mini"] })));
        const favoritesTab = within(modelPicker).getByRole("tab", { name: message("settings.favoriteModels") });
        await user.click(favoritesTab);
        expect(favoritesTab.getAttribute("aria-selected")).toBe("true");
        expect(within(listbox).getByRole("option", { name: "GPT-5 mini" })).toBeTruthy();
        fireEvent.mouseDown(document.body);
        await waitFor(() => expect(listbox.closest("details")?.open).toBe(false));
    });

    it("marks models from a multi-provider connection with their actual provider", async () => {
        const user = userEvent.setup();
        const connection = { id: "connection-1", provider: "opencode" as const, label: "OpenCode Zen", credentialSource: { kind: "environment-variable" as const, environmentVariableName: "OPENCODE_API_KEY" }, status: "connected" as const };
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue(["gpt-5", "claude-fable-5", "gemini-3-flash", "grok-4", "deepseek-v4", "big-pickle"]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.click(screen.getByRole("button", { name: message("settings.model") }));
        const listbox = screen.getAllByRole("listbox", { name: message("settings.model") })[0]!;

        expect(within(listbox).getByRole("option", { name: "GPT-5" }).querySelector('[data-provider="openai"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "GPT-5" }).querySelector('[data-provider="opencode"][data-via-provider="opencode"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "claude-fable-5" }).querySelector('[data-provider="anthropic"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "claude-fable-5" }).querySelector('[data-provider="opencode"][data-via-provider="opencode"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "gemini-3-flash" }).querySelector('[data-provider="google"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "grok-4" }).querySelector('[data-provider="xai"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "deepseek-v4" }).querySelector('[data-provider="deepseek"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "big-pickle" }).querySelector('[data-provider="opencode"]')?.tagName).toBe("svg");
        expect(within(listbox).getByRole("option", { name: "big-pickle" }).querySelector("[data-via-provider]")).toBeNull();
    });

});
