import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultGeneralSettings } from "@skladno/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App.js";
import { createFakeClient, resetWorkspaceTestEnvironment } from "../workspace/EditorialWorkspace.test-utils.js";


describe("Quick start", () => {
    afterEach(resetWorkspaceTestEnvironment);

    // Product scenarios: application.quick-start-initial-display, application.quick-start-dismissal, application.quick-start-reopening, application.quick-start-ai-settings
    it("guides first launch without changing workspace state", async () => {
        const user = userEvent.setup();
        const client = createFakeClient();
        const firstLaunch = render(<App client={client} />);

        const dialog = await screen.findByRole("dialog", { name: "Welcome to Skladno" });
        expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Add model key" }));
        expect(within(dialog).getByRole("button", { name: "Close quick start" })).toBeTruthy();
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(localStorage.getItem("skladno.quick-start.v1")).toBe("complete");
        expect(Object.keys(localStorage).filter((key) => key.startsWith("skladno.quick-start"))).toEqual(["skladno.quick-start.v1"]);

        firstLaunch.unmount();
        render(<App client={client} />);
        expect(screen.queryByRole("dialog")).toBeNull();

        await user.click((await screen.findAllByRole("button", { name: "Settings" })).at(-1)!);
        await user.selectOptions(screen.getByRole("combobox", { name: "Settings Navigation" }), "about");
        await user.click(screen.getByRole("button", { name: "Open quick start" }));
        expect(await screen.findByRole("dialog", { name: "Welcome to Skladno" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Add model key" }));
        expect(await screen.findByRole("heading", { name: "Connections" })).toBeTruthy();
        expect(client.updateArticle).not.toHaveBeenCalled();
    });

    it("starts writing when an active connection is usable", async () => {
        const client = createFakeClient();
        client.getApplicationSettings = vi.fn().mockResolvedValue({ general: defaultGeneralSettings, connections: [{ id: "connection", provider: "openai", label: "Personal AI", credentialSource: { kind: "environment-variable", environmentVariableName: "AI_API_KEY" }, active: true, status: "connected" }], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} });
        render(<App client={client} />);
        expect(await screen.findByRole("button", { name: "Start writing" })).toBeTruthy();
    });
});
