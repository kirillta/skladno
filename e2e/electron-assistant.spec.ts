import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";


async function unusedPort(): Promise<number> {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
        throw new Error("Could not reserve a local debugging port.");

    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    return address.port;
}


async function launchPackaged(root: string): Promise<{ process: ChildProcess; browser: Browser; page: Page }> {
    const port = await unusedPort();
    const executablePath = resolve("packages/electron/out/Skladno-win32-x64/Skladno.exe");
    const child = spawn(executablePath, ["--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${join(root, "profile")}`], {
        env: { ...process.env, SKLADNO_DATA_DIR: join(root, "data"), SKLADNO_AI_API_KEY: "" },
        stdio: "ignore",
    });

    try {
        await expect.poll(async () => {
            if (child.exitCode !== null)
                throw new Error("Packaged Skladno exited before opening its window.");

            try {
                return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
            } catch {
                return false;
            }
        }, { timeout: 30_000 }).toBe(true);

        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        await expect.poll(() => browser.contexts()[0]?.pages().length, { timeout: 30_000 }).toBeGreaterThan(0);
        const page = browser.contexts()[0]?.pages()[0];
        if (!page)
            throw new Error("Packaged Skladno opened no renderer page.");

        await page.waitForURL(/index\.html$/, { timeout: 30_000 });
        return { process: child, browser, page };
    } catch (error) {
        child.kill();
        throw error;
    }
}


async function closePackaged(app: { process: ChildProcess; browser: Browser; page: Page }): Promise<void> {
    if (app.process.exitCode !== null)
        return;

    const exited = once(app.process, "exit");
    void app.page.close().catch(() => undefined);
    await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 5_000))]);
    if (app.process.exitCode === null) {
        app.process.kill();
        throw new Error("Packaged Skladno did not close after its draft checkpoint.");
    }
}


test("packaged Electron Assistant failure preserves the Article and its Revision after restart", async () => {
    test.setTimeout(120_000);
    const root = mkdtempSync(join(tmpdir(), "skladno-electron-assistant-"));
    const resolvedRoot = realpathSync(root);
    if (!resolvedRoot.startsWith(`${realpathSync(tmpdir())}${sep}`))
        throw new Error("Unexpected Electron smoke data directory.");

    let app: Awaited<ReturnType<typeof launchPackaged>> | undefined;

    try {
        app = await launchPackaged(root);
        let page = app.page;
        await page.addInitScript(() => localStorage.setItem("skladno.quick-start.v1", "complete"));
        await page.reload();
        await expect(page.evaluate(() => "skladno" in window)).resolves.toBe(true);

        const create = page.getByRole("button", { name: "Create" });
        if (await create.isVisible())
            await create.click();
        else
            await page.getByRole("button", { name: "New article" }).click();

        const editor = page.getByRole("textbox", { name: "Article draft" });
        await editor.pressSequentially("Electron fixture Article.");
        await page.getByRole("button", { name: "Save revision" }).click();
        await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

        await page.getByRole("combobox", { name: "Editorial guidance" }).fill("Improve flow");
        await page.getByRole("button", { name: "Send editorial request" }).click();
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(editor).toContainText("Electron fixture Article.");

        await closePackaged(app);
        app = undefined;
        app = await launchPackaged(root);
        page = app.page;
        await expect(page.getByRole("textbox", { name: "Article draft" })).toContainText("Electron fixture Article.");
        await page.getByRole("tab", { name: "Revisions" }).click();
        await expect(page.getByRole("navigation", { name: "Revision history" })).toContainText("Added 25 characters");
    } finally {
        if (app)
            await closePackaged(app);

        rmSync(resolvedRoot, { recursive: true, force: true });
    }
});
