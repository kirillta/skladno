import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiModelPreferenceId } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";
import { resetApplicationSettingsTestEnvironment, settingsSnapshot } from "./ApplicationSettings.test-utils.js";

describe("ApplicationSettings AI", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    // Product scenarios: settings.available-model-list
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

    it("saves reasoning effort for the app model and task overrides", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
        HTMLElement.prototype.scrollIntoView = vi.fn();
        const connection = { id: "connection-1", provider: "openai" as const, label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY", status: "connected" as const };
        const updateModelPreferences = vi.fn().mockResolvedValue(undefined);
        const updateAppModel = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection], activeConnectionId: connection.id, appModel: { model: "gpt-5.5-mini" }, modelPreferences: { defaultModel: "gpt-5.5", skillOverrides: { talking_points: "gpt-5.5-mini" } } }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue(["gpt-5.5", "gpt-5.5-mini"]),
            updateModelPreferences,
            updateAppModel,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.selectOptions(screen.getAllByRole("combobox", { name: message("settings.reasoningEffort") })[1]!, "low");
        await waitFor(() => expect(updateAppModel).toHaveBeenCalledWith({ model: "gpt-5.5-mini", reasoningEffort: "low" }));

        await user.click(screen.getByRole("button", { name: message("settings.specificModels") }));
        expect(screen.getAllByRole("combobox", { name: message("settings.reasoningEffort") })).toHaveLength(3);
        expect(document.getElementById("specific-model-overrides")?.firstElementChild?.classList.contains("overflow-visible")).toBe(true);
        await user.selectOptions(screen.getAllByRole("combobox", { name: message("settings.reasoningEffort") })[2]!, "high");
        await waitFor(() => expect(updateModelPreferences).toHaveBeenCalledWith(expect.objectContaining({ skillReasoningEfforts: { talking_points: "high" } })));
    });

    it("filters models by vendor and saves favorites", async () => {
        const user = userEvent.setup();
        const connection = { id: "connection-1", provider: "openai" as const, label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY", status: "connected" as const };
        const anthropicConnection = { id: "connection-2", provider: "anthropic" as const, label: "Personal Claude", environmentVariableName: "ANTHROPIC_API_KEY", status: "connected" as const };
        const openCodeConnection = { id: "connection-3", provider: "opencode" as const, label: "OpenCode Zen", environmentVariableName: "OPENCODE_API_KEY", status: "connected" as const };
        const updateModelPreferences = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [connection, anthropicConnection, openCodeConnection], activeConnectionId: connection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            refreshAiModels: vi.fn().mockResolvedValue([
                { id: aiModelPreferenceId(connection.id, "gpt-5"), model: "gpt-5", connectionId: connection.id, provider: connection.provider },
                { id: aiModelPreferenceId(connection.id, "gpt-5-mini"), model: "gpt-5-mini", connectionId: connection.id, provider: connection.provider },
                { id: aiModelPreferenceId(anthropicConnection.id, "claude-sonnet"), model: "claude-sonnet", connectionId: anthropicConnection.id, provider: anthropicConnection.provider },
                { id: aiModelPreferenceId(openCodeConnection.id, "claude-sonnet-4-6"), model: "claude-sonnet-4-6", connectionId: openCodeConnection.id, provider: openCodeConnection.provider },
            ]),
            updateModelPreferences,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await user.click(screen.getByRole("button", { name: message("settings.model") }));
        const listbox = screen.getAllByRole("listbox", { name: message("settings.model") })[0]!;
        const modelPicker = listbox.closest("details")!;
        expect(within(listbox).queryByRole("option", { name: message("settings.chooseModel") })).toBeNull();
        expect(screen.queryByRole("tab", { name: "All models" })).toBeNull();
        expect(within(modelPicker).queryByRole("tab", { name: "Google Gemini API" })).toBeNull();
        const anthropicTab = within(modelPicker).getByRole("tab", { name: "Anthropic" });
        await user.click(anthropicTab);
        expect(anthropicTab.getAttribute("aria-selected")).toBe("true");
        expect(within(listbox).queryByRole("option", { name: "GPT-5" })).toBeNull();
        expect(within(listbox).getByRole("option", { name: "claude-sonnet" })).toBeTruthy();
        expect(within(listbox).queryByRole("option", { name: "claude-sonnet-4-6" })).toBeNull();
        await user.click(within(modelPicker).getByRole("tab", { name: "Other" }));
        expect(within(listbox).getByRole("option", { name: "claude-sonnet-4-6" })).toBeTruthy();
        expect(within(listbox).queryByRole("option", { name: "claude-sonnet" })).toBeNull();
        await user.click(within(modelPicker).getByRole("tab", { name: "OpenAI" }));
        expect(within(listbox).getByRole("option", { name: "GPT-5 mini" })).toBeTruthy();
        const search = screen.getAllByRole("textbox", { name: message("settings.searchModels") })[0]!;
        await user.type(search, "gpt");
        expect(within(listbox).getByRole("option", { name: "GPT-5" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: message("settings.clearModelSearch") }));
        expect(search.getAttribute("value")).toBe("");
        await user.type(search, "mini");
        await user.click(within(listbox).getByRole("button", { name: message("settings.addFavoriteModel", { model: "GPT-5 mini" }) }));

        await waitFor(() => expect(updateModelPreferences).toHaveBeenCalledWith(expect.objectContaining({ favoriteModels: [aiModelPreferenceId("connection-1", "gpt-5-mini")] })));
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
