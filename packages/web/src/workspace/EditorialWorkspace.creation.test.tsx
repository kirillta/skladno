import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../App.js";
import { message } from "../i18n/test-message.js";
import { fakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";


// Product scenarios: workspace.library.create-and-select, workspace.empty.create-article

describe("Editorial Workspace Article creation", () => {
    afterEach(resetWorkspaceTestEnvironment);

    it("selects an Article and creates a blank Article from the Article Library", async () => {
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);
        expect(await screen.findByRole("heading", { name: "First Article" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: message("navigation.newArticle") }));
        expect(await screen.findByRole("heading", { name: "New Article" })).toBeTruthy();
    });

    it("creates a blank Article from the empty Article workspace", async () => {
        const client = fakeClient();
        client.listArticles = async () => [];
        const user = userEvent.setup();
        render(<App client={client} />);
        await user.click(await screen.findByRole("button", { name: "Create" }));
        expect(client.createArticle).toHaveBeenCalledWith({ title: "Untitled article", content: "", language: "en", publishingProfileId: "default" });
    });
});
