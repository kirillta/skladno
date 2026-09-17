import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot } from "@skladno/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App.js";
import { createFakeClient, resetWorkspaceTestEnvironment } from "../workspace/EditorialWorkspace.test-utils.js";


describe("Quick start", () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute("open");
    });

    beforeEach(() => {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });
        Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: close });
    });

    afterEach(resetWorkspaceTestEnvironment);

    // Product scenarios: application.quick-start-initial-display, application.quick-start-dismissal, application.quick-start-reopening, application.quick-start-ai-settings
    it("guides first launch without changing workspace state", async () => {
        const user = userEvent.setup();
        const client = createFakeClient();
        const firstLaunch = render(<App client={client} />);

        const dialog = await screen.findByRole("dialog", { name: "Welcome to Skladno" });
        expect(showModal).toHaveBeenCalledWith();
        expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Add model key" }));
        expect(within(dialog).getByRole("button", { name: "Close quick start" })).toBeTruthy();
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(close).toHaveBeenCalledWith();
        expect(localStorage.getItem("skladno.quick-start.v1")).toBe("complete");
        expect(Object.keys(localStorage).filter((key) => key.startsWith("skladno.quick-start"))).toEqual(["skladno.quick-start.v1"]);

        firstLaunch.unmount();
        render(<App client={client} />);
        expect(screen.queryByRole("dialog")).toBeNull();

        await user.click((await screen.findAllByRole("button", { name: "Settings" })).at(-1)!);
        await user.selectOptions(screen.getByRole("combobox", { name: "Settings Navigation" }), "about");
        const openQuickStart = screen.getByRole("button", { name: "Open quick start" });
        await user.click(openQuickStart);
        let reopenedDialog = await screen.findByRole("dialog", { name: "Welcome to Skladno" });
        expect(document.activeElement).toBe(within(reopenedDialog).getByRole("button", { name: "Add model key" }));
        await user.click(within(reopenedDialog).getByRole("button", { name: "Close quick start" }));
        expect(document.activeElement).toBe(openQuickStart);
        await user.click(openQuickStart);
        reopenedDialog = await screen.findByRole("dialog", { name: "Welcome to Skladno" });
        await user.click(within(reopenedDialog).getByRole("button", { name: "Add model key" }));
        expect(await screen.findByRole("heading", { name: "Connections" })).toBeTruthy();
        expect(client.updateArticle).not.toHaveBeenCalled();
    });

    it("waits for current connection readiness and starts writing from Settings", async () => {
        const client = createFakeClient();
        client.getApplicationSettings = vi.fn().mockResolvedValue({ general: defaultGeneralSettings, connections: [{ id: "connection", provider: "openai", label: "Personal AI", credentialSource: { kind: "environment-variable", environmentVariableName: "AI_API_KEY" }, active: true, status: "connected" }], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} });
        const user = userEvent.setup();
        render(<App client={client} />);
        await user.click(await screen.findByRole("button", { name: "Start writing" }));
        await user.click((await screen.findAllByRole("button", { name: "Settings" })).at(-1)!);
        await user.selectOptions(screen.getByRole("combobox", { name: "Settings Navigation" }), "about");
        await user.click(screen.getByRole("button", { name: "Open quick start" }));
        await user.click(await screen.findByRole("button", { name: "Start writing" }));
        expect(await screen.findByRole("heading", { name: "First Article" })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "About Skladno" })).toBeNull();
    });

    it("does not choose an action before delayed Settings load", async () => {
        const client = createFakeClient();
        const pending: ((settings: ApplicationSettingsSnapshot) => void)[] = [];
        client.getApplicationSettings = vi.fn(() => new Promise<ApplicationSettingsSnapshot>((resolve) => pending.push(resolve)));
        render(<App client={client} />);
        expect(screen.queryByRole("dialog")).toBeNull();
        await waitFor(() => expect(pending.length).toBeGreaterThan(0));
        pending.forEach((resolve) => resolve({ general: defaultGeneralSettings, connections: [{ id: "connection", provider: "openai", label: "Personal AI", credentialSource: { kind: "environment-variable", environmentVariableName: "AI_API_KEY" }, active: true, status: "connected" }], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} }));
        expect(await screen.findByRole("button", { name: "Start writing" })).toBeTruthy();
    });

    it("opens with model-key guidance when initial Settings load fails", async () => {
        const client = createFakeClient();
        client.getApplicationSettings = vi.fn().mockRejectedValue(new Error("service unavailable"));
        render(<App client={client} />);
        expect(await screen.findByRole("button", { name: "Add model key" })).toBeTruthy();
    });

    it("refreshes readiness when reopened", async () => {
        const client = createFakeClient();
        let settings: ApplicationSettingsSnapshot = { general: defaultGeneralSettings, connections: [], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} };
        client.getApplicationSettings = vi.fn().mockImplementation(() => Promise.resolve(settings));
        const user = userEvent.setup();
        render(<App client={client} />);
        await user.click(await screen.findByRole("button", { name: "Skip quick start" }));
        settings = { ...settings, connections: [{ id: "connection", provider: "openai" as const, label: "Personal AI", credentialSource: { kind: "environment-variable" as const, environmentVariableName: "AI_API_KEY" }, active: true, status: "connected" as const }] };
        await user.click((await screen.findAllByRole("button", { name: "Settings" })).at(-1)!);
        await user.selectOptions(screen.getByRole("combobox", { name: "Settings Navigation" }), "about");
        await user.click(screen.getByRole("button", { name: "Open quick start" }));
        expect(await screen.findByRole("button", { name: "Start writing" })).toBeTruthy();
    });
});
