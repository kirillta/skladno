import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { NotificationProvider } from "../notifications/NotificationProvider.js";
import { ApplicationSettings } from "./ApplicationSettings.js";

// Product scenarios: settings.general-time-zone-preferences, settings.ai-connection-lifecycle

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
    afterEach(cleanup);


    it("persists an accessible explicit time-zone selection and previews it", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            updateGeneralSettings,
            getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        const heading = await screen.findByText("Time zone");
        const select = heading.parentElement?.querySelector("select") as HTMLSelectElement;

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

        await user.click(screen.getByRole("button", { name: "Use system time zone" }));

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenLastCalledWith(defaultGeneralSettings));
    });


    it("offers system and explicit date formats and resets only the date preference", async () => {
        const user = userEvent.setup();
        const updateGeneralSettings = vi.fn().mockResolvedValue(defaultGeneralSettings);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            updateGeneralSettings,
            getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        const heading = await screen.findByText("Date format");
        const select = heading.parentElement?.querySelector("select") as HTMLSelectElement;

        expect(select.getAttribute("aria-describedby")).toBeTruthy();
        expect([...select.options].map((option) => option.value)).toEqual(["system", "day-first", "day-first-dots", "month-first", "iso"]);
        expect(select.options[0]?.textContent).toMatch(/^System date format \(.+\)$/);

        await user.selectOptions(select, "day-first-dots");

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...defaultGeneralSettings,
            dateFormat: "day-first-dots",
        }));

        const reset = screen.getByRole("button", { name: "Use system date format" });
        expect((reset as HTMLButtonElement).disabled).toBe(false);
        await user.click(reset);

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenLastCalledWith(defaultGeneralSettings));
        expect((reset as HTMLButtonElement).disabled).toBe(true);
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
            getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await screen.findByText("Time format");
        await user.click(screen.getByRole("button", { name: "Use system time format" }));

        await waitFor(() => expect(updateGeneralSettings).toHaveBeenCalledWith({
            ...general,
            timeFormat: "system",
        }));
    });

    it("allows entering an environment-variable name for a new AI connection", async () => {
        const user = userEvent.setup();
        const addOpenAiConnection = vi.fn().mockResolvedValue({
            id: "connection-1",
            provider: "openai",
            label: "Personal OpenAI",
            environmentVariableName: "OPENAI_API_KEY",
            status: "unchecked",
        });
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue(settingsSnapshot()),
            getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"),
            addOpenAiConnection,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: "AI" }));
        const connectionName = screen.getByPlaceholderText("For example, Personal OpenAI");
        const environmentName = screen.getByPlaceholderText("For example, OPENAI_API_KEY");

        expect(connectionName.hasAttribute("readonly")).toBe(false);
        expect(environmentName.hasAttribute("readonly")).toBe(false);

        await user.type(connectionName, "Personal OpenAI");
        fireEvent.paste(environmentName, {
            clipboardData: {
                getData: () => "OPENAI_API_KEY",
            },
        });
        await user.click(screen.getByRole("button", { name: "Add connection" }));

        await waitFor(() => expect(addOpenAiConnection).toHaveBeenCalledWith({
            label: "Personal OpenAI",
            environmentVariableName: "OPENAI_API_KEY",
        }));
        expect((connectionName as HTMLInputElement).value).toBe("");
        expect((environmentName as HTMLInputElement).value).toBe("");
        expect(screen.getByText("Configured connections")).toBeTruthy();
        expect(screen.getAllByText("Personal OpenAI")).toHaveLength(1);
        expect(screen.getByText("OPENAI_API_KEY")).toBeTruthy();
    });

    it("prevents duplicate environment-variable names and manages saved connections", async () => {
        const user = userEvent.setup();
        const firstConnection = { id: "connection-1", provider: "openai" as const, label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY", status: "unchecked" as const };
        const secondConnection = { id: "connection-2", provider: "openai" as const, label: "Work OpenAI", environmentVariableName: "WORK_OPENAI_API_KEY", status: "unchecked" as const };
        const setActiveOpenAiConnection = vi.fn().mockResolvedValue(undefined);
        const removeOpenAiConnection = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [firstConnection, secondConnection], activeConnectionId: firstConnection.id }),
            getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"),
            addOpenAiConnection: vi.fn(),
            setActiveOpenAiConnection,
            removeOpenAiConnection,
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);

        await user.click(await screen.findByRole("button", { name: "AI" }));
        await user.type(screen.getByPlaceholderText("For example, OPENAI_API_KEY"), "OPENAI_API_KEY");
        await user.click(screen.getByRole("button", { name: "Add connection" }));

        expect(screen.getByRole("alert").textContent).toContain("already saved");
        expect(client.addOpenAiConnection).not.toHaveBeenCalled();
        expect(screen.getAllByRole("button", { name: "Remove connection" })).toHaveLength(1);

        await user.click(screen.getByRole("button", { name: "Use this connection" }));
        await waitFor(() => expect(setActiveOpenAiConnection).toHaveBeenCalledWith(secondConnection.id));

        await user.click(screen.getAllByRole("button", { name: "Remove connection" })[0]!);
        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: "Remove connection" }));

        await waitFor(() => expect(removeOpenAiConnection).toHaveBeenCalledWith(firstConnection.id));
        expect(screen.queryByText("Personal OpenAI")).toBeNull();
    });
});
