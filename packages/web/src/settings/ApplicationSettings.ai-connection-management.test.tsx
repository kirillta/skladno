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

describe("ApplicationSettings AI connection management", () => {
    afterEach(resetApplicationSettingsTestEnvironment);

    it("allows shared environment-variable names and manages saved connections", async () => {
        const user = userEvent.setup();
        const firstConnection = { id: "connection-1", provider: "openai" as const, label: "Personal AI", environmentVariableName: "AI_API_KEY", status: "unchecked" as const };
        const secondConnection = { id: "connection-2", provider: "openai" as const, label: "Work AI", environmentVariableName: "WORK_AI_API_KEY", status: "unchecked" as const };
        const thirdConnection = { id: "connection-3", provider: "openai" as const, label: "Another AI", credentialSource: { kind: "environment-variable" as const, environmentVariableName: "AI_API_KEY" }, status: "unchecked" as const };
        const setAiConnectionActive = vi.fn().mockResolvedValue({ ...secondConnection, active: false });
        const removeAiConnection = vi.fn().mockResolvedValue(undefined);
        const client = {
            getApplicationSettings: vi.fn().mockResolvedValue({ ...settingsSnapshot(), connections: [firstConnection, secondConnection], activeConnectionId: firstConnection.id }),
            getPublishingSettings: vi.fn().mockResolvedValue({ defaultProfileId: "default", customProfiles: [] }),
            addAiConnection: vi.fn().mockResolvedValue(thirdConnection),
            setAiConnectionActive,
            removeAiConnection,
            refreshAiModels: vi.fn().mockResolvedValue([]),
        } as unknown as EditorialWorkspaceClient;

        render(<IntlProvider locale="en" messages={messages}><NotificationProvider><ApplicationSettings client={client} back={vi.fn()} /></NotificationProvider></IntlProvider>);
        await user.click(await screen.findByRole("button", { name: message("settings.ai") }));
        await waitFor(() => expect(client.refreshAiModels).toHaveBeenCalledOnce());
        await user.type(screen.getByPlaceholderText("For example, Personal AI"), thirdConnection.label);
        await user.type(screen.getByPlaceholderText("For example, AI_API_KEY"), "AI_API_KEY");
        await user.click(screen.getByRole("button", { name: message("settings.addConnectionButton") }));
        await waitFor(() => expect(client.addAiConnection).toHaveBeenCalledWith({ provider: "openai", label: thirdConnection.label, environmentVariableName: "AI_API_KEY" }));
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.getAllByRole("button", { name: message("settings.removeConnectionShort") })).toHaveLength(3);
        await user.click(screen.getAllByRole("button", { name: message("settings.deactivateConnectionShort") })[1]!);
        await waitFor(() => expect(setAiConnectionActive).toHaveBeenCalledWith(secondConnection.id, false));
        await user.click(screen.getAllByRole("button", { name: message("settings.removeConnectionShort") })[0]!);
        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: message("settings.removeConnection") }));
        await waitFor(() => expect(removeAiConnection).toHaveBeenCalledWith(firstConnection.id));
        expect(screen.queryByText("Personal OpenAI")).toBeNull();
    });
});
