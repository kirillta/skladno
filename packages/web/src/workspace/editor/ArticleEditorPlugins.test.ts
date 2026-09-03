import { $createRangeSelection, $getRoot, $getSelection, $setSelection, createEditor, type RangeSelection } from "lexical";
import { describe, expect, it } from "vitest";
import { articleEditorNodes } from "./article-editor-config.js";
import { captureAssistantSelection } from "./ArticleEditorPlugins.js";
import { exportArticleMarkdown, importArticleMarkdown } from "./markdown.js";


describe("captureAssistantSelection", () => {
    it("maps a rich multi-block Unicode selection to exact Markdown offsets without changing the Article", () => {
        const editor = createEditor({
            namespace: "assistant-selection-test",
            nodes: articleEditorNodes,
            onError: (error) => {
                throw error;
            },
        });
        let selected: RangeSelection | undefined;
        let markdown = "";

        editor.update(() => {
            importArticleMarkdown([
                "# Heading",
                "",
                "A **bold** *italic* [link](https://example.test) and `code`.",
                "",
                "- First café",
                "- Second café 🙂",
                "",
                "```",
                "const repeated = \"café 🙂\";",
                "```",
            ].join("\n"));
            markdown = exportArticleMarkdown();
            const first = $getRoot().getAllTextNodes().find((node) => node.getTextContent() === "First café");
            const second = $getRoot().getAllTextNodes().find((node) => node.getTextContent() === "Second café 🙂");
            expect(first).toBeTruthy();
            expect(second).toBeTruthy();

            const range = $createRangeSelection();
            range.anchor.set(first!.getKey(), "First ".length, "text");
            range.focus.set(second!.getKey(), "Second café 🙂".length, "text");
            $setSelection(range);
            selected = ($getSelection() as RangeSelection).clone();
        }, { discrete: true });

        const snapshot = captureAssistantSelection(editor, selected!);

        expect(snapshot).toEqual({
            markdown,
            preview: "café\nSecond café 🙂",
            startOffset: markdown.indexOf("café"),
            endOffset: markdown.indexOf("Second café 🙂") + "Second café 🙂".length,
        });
        editor.getEditorState().read(() => expect(exportArticleMarkdown()).toBe(markdown));
    });
});
