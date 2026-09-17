import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultGeneralSettings } from "@skladno/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App.js";
import { getMessage } from "../i18n/test-message.js";
import { createFakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";

describe("Editorial Workspace settings", () => {
    afterEach(resetWorkspaceTestEnvironment);

    // Product scenario: application.open-settings-without-empty-workspace
    it("opens Application Settings without replacing the workspace with an empty view", async () => {
        const user = userEvent.setup();
        render(<App client={createFakeClient()} />);
        await user.click((await screen.findAllByRole("button", { name: getMessage("navigation.settings") })).at(-1)!);
        expect(screen.getByRole("heading", { name: getMessage("settings.general") })).toBeTruthy();
        expect(screen.getByText("Preferred appearance")).toBeTruthy();
    });

    // Product scenario: application.ai-connection-onboarding-warning
    it("warns when no active connected AI connection is available and opens AI Settings", async () => {
        const client = createFakeClient();
        const user = userEvent.setup();
        render(<App client={client} />);
        expect(await screen.findByText(getMessage("workspace.aiConnectionRequired"))).toBeTruthy();
        expect(screen.getByText(getMessage("workspace.aiConnectionCapabilities"))).toBeTruthy();
        await user.click(screen.getAllByRole("button", { name: "Add model key" }).at(-1)!);
        expect(await screen.findByRole("heading", { name: "Connections" })).toBeTruthy();
    });

    it.each([
        { active: true, status: "connected" as const },
        { active: true, status: "unavailable" as const },
    ])("shows the AI connection warning only for an unusable connection state", async (connection) => {
        const client = createFakeClient();
        client.getApplicationSettings = vi.fn().mockResolvedValue({ general: defaultGeneralSettings, connections: [{ id: "connection", provider: "openai", label: "Personal AI", credentialSource: { kind: "environment-variable", environmentVariableName: "AI_API_KEY" }, ...connection }], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} });
        render(<App client={client} />);
        await screen.findByRole("heading", { name: "First Article" });
        if (connection.status === "unavailable")
            expect(await screen.findByText(getMessage("workspace.aiConnectionRequired"))).toBeTruthy();
        else
            await waitFor(() => expect(screen.queryByText(getMessage("workspace.aiConnectionRequired"))).toBeNull());
    });

    it("surfaces Application Settings save failures through the notification center", async () => {
        const client = createFakeClient();
        client.updateGeneralSettings = vi.fn().mockRejectedValue(new Error("private settings detail"));
        const user = userEvent.setup();
        render(<App client={client} />);
        await user.click((await screen.findAllByRole("button", { name: getMessage("navigation.settings") })).at(-1)!);
        const appearance = screen.getByText("Preferred appearance").closest("section")?.querySelector("select");
        await user.selectOptions(appearance!, "dark");
        expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save your Settings. Your previous Settings are unchanged. Try again.");
        expect(screen.queryByText("private settings detail")).toBeNull();
    });
});
