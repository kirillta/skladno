import { expect, test, type Locator } from "@playwright/test";


async function activateWithKeyboard(page: import("@playwright/test").Page, target: Locator): Promise<void> {
    await target.focus();
    await page.keyboard.press("Enter");
}


async function createArticle(page: import("@playwright/test").Page): Promise<void> {
    const create = page.getByRole("button", { name: "Create" });
    if (await create.isVisible())
        await create.click();
    else
        await page.getByRole("button", { name: "New article" }).click();

    await page.getByRole("button", { name: /Rename article:/ }).click();
    await page.getByRole("textbox", { name: "Article title" }).fill("Fixture Article");
    await page.getByRole("textbox", { name: "Article draft" }).pressSequentially("Original fixture Article.");
    await page.getByRole("button", { name: "Save revision" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
}


test("critical local-first author journeys use deterministic provider output", async ({ page }) => {
    await page.goto("/");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Publishing" }).click();
    await page.getByRole("group", { name: "Default translation languages" }).getByRole("checkbox", { name: "Spanish" }).check();
    const publishingProfileSaved = page.waitForResponse((response) => response.url().endsWith("/api/settings/publish-limit-profile") && response.request().method() === "PUT");
    await page.getByRole("combobox", { name: "Character-limit profile" }).selectOption("linkedin-post");
    await publishingProfileSaved;
    await page.getByRole("button", { name: "Back to workspace" }).click();
    await createArticle(page);
    await expect(page.getByRole("button", { name: "Character count: 25 of 3,000 characters" })).toBeVisible();
    await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);

    await page.getByRole("combobox", { name: "Editorial guidance" }).fill("Improve flow");
    await page.getByRole("button", { name: "Send editorial request" }).click();
    await expect(page.getByRole("tab", { name: /Proposal/ })).toBeVisible();
    await page.getByRole("tab", { name: /Proposal/ }).click();
    await expect(page.getByText("Improved fixture note.")).toBeVisible();

    await page.getByRole("button", { name: "Accept all" }).click();
    await page.getByRole("tab", { name: "Write" }).click();
    await expect(page.getByRole("textbox", { name: "Article draft" })).toContainText("Improved fixture note.");

    await page.getByRole("tab", { name: "Revisions" }).click();
    await page.getByRole("navigation", { name: "Revision history" }).getByRole("button", { name: "Author Revision" }).click();
    await page.getByRole("button", { name: "Restore this revision" }).click();
    await page.getByRole("button", { name: "Restore revision" }).click();
    await expect(page.getByText("Restored Revision").first()).toBeVisible();

    await page.getByRole("combobox", { name: "Editorial guidance" }).fill("fact check");
    await page.getByRole("button", { name: "Send editorial request" }).click();
    await expect(page.getByRole("tab", { name: /Fact Check/ })).toBeVisible();
    await page.getByRole("tab", { name: /Fact Check/ }).click();
    await expect(page.getByText("The fixture claim is supported.").first()).toBeVisible();

    await page.getByRole("tab", { name: /Style Profile/ }).click();
    await expect(page.getByRole("heading", { name: "Style Profile" })).toBeVisible();

    await page.getByRole("tab", { name: "Write" }).click();
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Original fixture Article.");
    await page.getByRole("button", { name: "Copy options" }).click();
    await page.getByRole("menuitem", { name: "Copy plain text" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Original fixture Article.");

    await page.getByRole("tab", { name: "Translations" }).click();
    await page.getByRole("button", { name: "Translate" }).click();
    await page.getByRole("button", { name: "Edit Spanish translation" }).click();
    await expect(page.getByText("Fixture Article — Spanish").first()).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "General" }).click();
    await page.getByRole("combobox").first().selectOption("dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});


test("a cancelled assistant stream does not change the Article", async ({ page }) => {
    await page.goto("/");
    await createArticle(page);

    await page.getByRole("combobox", { name: "Editorial guidance" }).fill("wait");
    await page.getByRole("button", { name: "Send editorial request" }).click();
    await page.getByRole("button", { name: "Stop request" }).click();
    await expect(page.getByText("Original fixture Article.").first()).toBeVisible();
});


test("a provider failure does not change the Article", async ({ page }) => {
    await page.goto("/");
    await createArticle(page);

    await page.getByRole("combobox", { name: "Editorial guidance" }).fill("provider error");
    await page.getByRole("button", { name: "Send editorial request" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Article draft" })).toContainText("Original fixture Article.");
});


test("the Assistant Lexical composer supports skill tags and slash invocation", async ({ page }) => {
    await page.goto("/");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
    await createArticle(page);

    const composer = page.getByRole("combobox", { name: "Editorial guidance" });
    await composer.fill("Keep this focused /nar");
    await expect(composer).toHaveAttribute("aria-expanded", "true");
    await expect(composer).toHaveAttribute("aria-activedescendant", "assistant-skill-option-narrative_draft");
    await expect(page.getByRole("listbox", { name: "Quick actions" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Narrative draft" })).toBeVisible();
    await page.getByRole("option", { name: "Narrative draft" }).click();
    await expect(page.getByLabel("Remove Narrative draft")).toBeVisible();
    await expect(composer).not.toContainText("/nar");

    await page.getByLabel("Remove Narrative draft").click();
    await expect(page.getByLabel("Remove Narrative draft")).toHaveCount(0);

    await composer.fill("word/nar");
    await expect(page.getByRole("listbox", { name: "Quick actions" })).toHaveCount(0);
    await composer.fill("https://example.test/nar");
    await expect(page.getByRole("listbox", { name: "Quick actions" })).toHaveCount(0);
    await composer.fill("`/nar`");
    await expect(page.getByRole("listbox", { name: "Quick actions" })).toHaveCount(0);

    await composer.fill("/f");
    await composer.press("ArrowDown");
    await expect(composer).toHaveAttribute("aria-activedescendant", "assistant-skill-option-fact_checking");
    await composer.press("Tab");
    await expect(page.getByLabel("Remove Fact checking")).toBeVisible();
    await page.getByLabel("Remove Fact checking").click();

    await composer.fill("/sty");
    await composer.press("Escape");
    await expect(page.getByRole("listbox", { name: "Quick actions" })).toHaveCount(0);
    await expect(composer).toContainText("/sty");

    await composer.fill("before ");
    await page.getByRole("button", { name: "Quick actions" }).click();
    await page.getByRole("option", { name: "Flow and clarity" }).click();
    await expect(page.getByLabel("Remove Flow and clarity")).toBeVisible();
    await page.getByRole("button", { name: "Collapse Editorial Assistant Panel" }).click();
    await page.getByRole("button", { name: "Expand Editorial Assistant Panel" }).click();
    await expect(page.getByLabel("Remove Flow and clarity")).toBeVisible();
    await page.getByLabel("Remove Flow and clarity").click();

    await composer.focus();
    await page.evaluate(() => navigator.clipboard.writeText("shortcut paste"));
    await composer.press("Control+V");
    await expect(composer).toContainText("shortcut paste");
    await composer.fill("");

    await composer.evaluate((element) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/plain", "plain\ntext");
        element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));
    });
    await expect(composer).toContainText("plain");
    await expect(composer).toContainText("text");
});


test("Assistant skill tags delete as single Lexical tokens", async ({ page }) => {
    await page.goto("/");
    await createArticle(page);

    await page.getByRole("button", { name: "Quick actions" }).click();
    await page.getByRole("option", { name: "Flow and clarity" }).click();
    await expect(page.getByLabel("Remove Flow and clarity")).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(page.getByLabel("Remove Flow and clarity")).toHaveCount(0);
});


test("Assistant skill tags delete from their preceding boundary", async ({ page }) => {
    await page.goto("/");
    await createArticle(page);

    await page.getByRole("button", { name: "Quick actions" }).click();
    await page.getByRole("option", { name: "Flow and clarity" }).click();
    await expect(page.getByLabel("Remove Flow and clarity")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Delete");
    await expect(page.getByLabel("Remove Flow and clarity")).toHaveCount(0);
});


test("an unavailable automatic backup does not prevent editing", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Data & backups" }).click();
    await page.getByRole("switch", { name: "Automatic backups" }).click();
    await page.getByRole("button", { name: "Back to workspace" }).click();
    await page.reload();

    await createArticle(page);
});


for (const run of [
    { name: "1440 x 1024 light", viewport: { width: 1440, height: 1024 }, colorScheme: "light" as const },
    { name: "1280 x 800 dark", viewport: { width: 1280, height: 800 }, colorScheme: "dark" as const },
]) {
    test(`keyboard release coverage at ${run.name}`, async ({ page }) => {
        await page.setViewportSize(run.viewport);
        await page.emulateMedia({ colorScheme: run.colorScheme });
        await page.goto("/");

        await activateWithKeyboard(page, page.getByRole("button", { name: "Settings" }));
        for (const section of ["General", "Key bindings", "AI", "Publishing", "Data & backups"])
            await activateWithKeyboard(page, page.getByRole("button", { name: section }));

        await activateWithKeyboard(page, page.getByRole("button", { name: "Back to workspace" }));

        await page.keyboard.press("Tab");
        await expect(page.evaluate(() => document.activeElement?.tagName))
            .resolves.toMatch(/BUTTON|DIV/);

        await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
            .resolves.toBeTruthy();
    });
}
