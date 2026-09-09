import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultGeneralSettings } from "@skladno/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App.js";
import { message } from "../i18n/test-message.js";
import { fakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";

describe("Editorial Workspace settings", () => {
    afterEach(resetWorkspaceTestEnvironment);

    // Product scenario: application.open-settings-without-empty-workspace
    it("opens Application Settings without replacing the workspace with an empty view", async () => {
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);
        await user.click((await screen.findAllByRole("button", { name: message("navigation.settings") })).at(-1)!);
        expect(screen.getByRole("heading", { name: message("settings.general") })).toBeTruthy();
        expect(screen.getByText("Preferred appearance")).toBeTruthy();
    });

    // Product scenario: application.ai-connection-onboarding-warning
    it("warns when no active connected AI connection is available and opens AI Settings", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        render(<App client={client} />);
        expect(await screen.findByText(message("workspace.aiConnectionRequired"))).toBeTruthy();
        expect(screen.getByText(message("workspace.aiConnectionCapabilities"))).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Add model key" }));
        expect(await screen.findByRole("heading", { name: "Connections" })).toBeTruthy();
    });

    it.each([
        { active: true, status: "connected" as const },
        { active: true, status: "unavailable" as const },
    ])("shows the AI connection warning only for an unusable connection state", async (connection) => {
        const client = fakeClient();
        client.getApplicationSettings = vi.fn().mockResolvedValue({ general: defaultGeneralSettings, connections: [{ id: "connection", provider: "openai", label: "Personal AI", credentialSource: { kind: "environment-variable", environmentVariableName: "AI_API_KEY" }, ...connection }], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} });
        render(<App client={client} />);
        await screen.findByRole("heading", { name: "First Article" });
        if (connection.status === "unavailable")
            expect(await screen.findByText(message("workspace.aiConnectionRequired"))).toBeTruthy();
        else
            await waitFor(() => expect(screen.queryByText(message("workspace.aiConnectionRequired"))).toBeNull());
    });

    it("surfaces Application Settings save failures through the notification center", async () => {
        const client = fakeClient();
        client.updateGeneralSettings = vi.fn().mockRejectedValue(new Error("private settings detail"));
        const user = userEvent.setup();
        render(<App client={client} />);
        await user.click((await screen.findAllByRole("button", { name: message("navigation.settings") })).at(-1)!);
        const appearance = screen.getByText("Preferred appearance").closest("section")?.querySelector("select");
        await user.selectOptions(appearance!, "dark");
        expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save your Settings. Your previous Settings are unchanged. Try again.");
        expect(screen.queryByText("private settings detail")).toBeNull();
    });
});
