import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot, type DesktopSettingsClient, type DesktopUpdateClient } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";
import { saveWebBackup } from "./web-backups.js";
import { UpdatesSettingsGroup } from "./components/UpdatesSettingsGroup.js";

vi.mock("./web-backups.js", () => ({
    chooseBackupFolder: vi.fn().mockResolvedValue("Skladno backups"),
    saveWebBackup: vi.fn().mockResolvedValue("skladno-manual.sqlite"),
    saveScheduledWebBackup: vi.fn(),
    selectedBackupFolderName: vi.fn().mockResolvedValue(undefined),
}));


// Product scenarios: settings.general-time-zone-preferences, settings.ai-connection-lifecycle, settings.available-model-list

function settingsSnapshot(): ApplicationSettingsSnapshot {
    return {
        general: defaultGeneralSettings,
        connections: [],
        modelPreferences: { defaultModel: "", skillOverrides: {} },
        backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } },
        keyBindingOverrides: {},
    };
}


describe("ApplicationSettings", () => {
    afterEach(() => {
        cleanup();
        window.skladnoDesktop = undefined;
        window.skladnoUpdates = undefined;
    });


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
        const setAutomaticChecks = vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: false });
        window.skladnoUpdates = {
            getState: vi.fn().mockResolvedValue({ kind: "unsupported", currentVersion: "0.0.0", automaticChecks: true }), setAutomaticChecks, checkNow: vi.fn(), download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined,
        };
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        expect(await screen.findByRole("heading", { name: message("settings.updates") })).toBeTruthy();
        expect(screen.getAllByText(message("settings.updatesUnavailable"))).toHaveLength(1);
        await userEvent.setup().click(screen.getByRole("switch", { name: message("settings.automaticUpdates") }));
        expect(setAutomaticChecks).toHaveBeenCalledWith(false);
    });


    // Product scenarios: settings.preview-update-controls
    it("keeps preview update download explicit in General Settings", async () => {
        const user = userEvent.setup();
        const checkNow = vi.fn().mockResolvedValue({ kind: "available", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1.security", title: "Security preview", summary: "Security fixes", releaseNotesUrl: "https://example.test/release", security: true, automaticChecks: true });
        const updates: DesktopUpdateClient = {
            getState: vi.fn().mockResolvedValue({ kind: "current", currentVersion: "0.1.0-preview.1", automaticChecks: true }), setAutomaticChecks: vi.fn(), checkNow, download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined,
        };
        render(<IntlProvider locale="en" messages={messages}><UpdatesSettingsGroup client={updates} desktop /></IntlProvider>);

        expect((await screen.findByRole("switch", { name: message("settings.automaticUpdates") })).getAttribute("aria-checked")).toBe("true");
        expect(screen.queryByRole("button", { name: message("settings.downloadUpdate") })).toBeNull();
        await user.click(screen.getByRole("button", { name: message("settings.checkNow") }));
        await screen.findByRole("button", { name: message("settings.downloadUpdate") });
        expect(checkNow).toHaveBeenCalledOnce();
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
            label: "Personal AI",
            environmentVariableName: "AI_API_KEY",
        }));
        expect((connectionName as HTMLInputElement).value).toBe("");
        expect((environmentName as HTMLInputElement).value).toBe("");
        expect(screen.getByText("Configured connections")).toBeTruthy();
        expect(screen.getAllByText("Personal AI")).toHaveLength(1);
        expect(screen.getByText("AI_API_KEY")).toBeTruthy();
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

        await waitFor(() => expect(addManagedAiConnection).toHaveBeenCalledWith({ label: "Personal AI", apiKey: "<REDACTED>" }));
        expect(screen.queryByDisplayValue("<REDACTED>")).toBeNull();
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
