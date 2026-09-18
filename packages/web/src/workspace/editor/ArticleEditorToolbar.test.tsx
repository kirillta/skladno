import { createEditor } from "lexical";
import { describe, expect, it, vi } from "vitest";

import { renderLocalized } from "../EditorialWorkspace.test-utils.js";
import { ArticleEditorToolbar } from "./ArticleEditorToolbar.js";
import { articleEditorNodes } from "./article-editor-config.js";


describe("ArticleEditorToolbar", () => {
    it("provides named toolbar controls with their available shortcuts", () => {
        const toolbar = renderLocalized(<ArticleEditorToolbar editor={createEditor({ namespace: "toolbar-test", nodes: articleEditorNodes, onError: vi.fn() })} openLink={vi.fn()} />);

        const title = (role: "button" | "combobox", name: string) => toolbar.getByRole(role, { name }).getAttribute("title");
        expect(title("combobox", "Block style")).toBe("Block style");
        expect(title("button", "Bold")).toBe("Bold (Ctrl + B)");
        expect(title("button", "Italic")).toBe("Italic (Ctrl + I)");
        expect(title("button", "Strikethrough")).toBe("Strikethrough");
        expect(title("button", "Inline code")).toBe("Inline code");
        expect(title("button", "Link")).toBe("Link");
        expect(title("button", "Bulleted list")).toBe("Bulleted list");
        expect(title("button", "Numbered list")).toBe("Numbered list");
    });
});
