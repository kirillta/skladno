import { CodeNode } from "@lexical/code";
import { $generateNodesFromDOM } from "@lexical/html";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertToMarkdownString } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, createEditor } from "lexical";
import { describe, expect, test } from "vitest";
import { articleMarkdownTransformers, exportArticleMarkdown, importArticleMarkdown } from "./markdown.js";
import { sanitizeRichPasteDocument } from "./paste.js";


function importHtmlAsMarkdown(html: string): string {
    const editor = createEditor({
        namespace: "paste-test",
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode],
        onError: (error) => {
            throw error;
        },
    });
    let markdown = "";

    editor.update(() => {
        const document = sanitizeRichPasteDocument(html);
        $getRoot().append(...$generateNodesFromDOM(editor, document));
        markdown = $convertToMarkdownString(articleMarkdownTransformers, undefined, true);
    }, { discrete: true });

    return markdown;
}


function normalizeMarkdown(markdown: string): string {
    const editor = createEditor({
        namespace: "markdown-normalization-test",
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode],
        onError: (error) => {
            throw error;
        },
    });
    let normalized = "";

    editor.update(() => {
        importArticleMarkdown(markdown);
        normalized = exportArticleMarkdown();
    }, { discrete: true });

    return normalized;
}


describe("Word and rich-text paste", () => {
    test("preserves blocks, combined inline formatting, and one contiguous Word list", () => {
        const html = `
            <h2>10. Situación política hipotética<br><span></span></h2>
            <p><span style="font-weight: bold">Situación:</span><br><span></span></p>
            <p>Sos <span style="font-style: italic">asesor</span> de un gobernador argentino.</p>
            <p class="MsoListParagraphCxSpFirst" style="mso-list: l0 level1 lfo1"><span style="mso-list: Ignore">•&nbsp;</span>qué harías primero;<br></p>
            <p class="MsoListParagraphCxSpMiddle" style="mso-list: l0 level1 lfo1"><span style="mso-list: Ignore">•&nbsp;</span><span style="font-weight: 700; font-style: italic">qué medidas evitarías;</span><br></p>
            <p class="MsoListParagraphCxSpLast" style="mso-list: l0 level1 lfo1"><span style="mso-list: Ignore">•&nbsp;</span>qué consecuencias podrían aparecer.<br></p>
            <p><strong>Debés usar:</strong></p>
        `;

        const markdown = importHtmlAsMarkdown(html);
        expect(markdown).toBe([
            "## 10. Situación política hipotética",
            "**Situación:**",
            "Sos *asesor* de un gobernador argentino.",
            "- qué harías primero;",
            "- ***qué medidas evitarías;***",
            "- qué consecuencias podrían aparecer.",
            "**Debés usar:**",
        ].join("\n"));
        expect(normalizeMarkdown(markdown)).toBe(markdown);
    });

    test("preserves semantic headings, quotes, nested lists, links, and code", () => {
        const html = `
            <h1>Heading</h1>
            <blockquote>Quoted <strong>claim</strong></blockquote>
            <ol>
                <li>First</li>
                <li>Second<ul><li>Nested</li></ul></li>
            </ol>
            <p>Read <a href="https://example.com/docs">the docs</a> and run <code>npm test</code>.</p>
            <pre>const safe = true;</pre>
        `;

        const markdown = importHtmlAsMarkdown(html);

        expect(markdown).toContain("# Heading");
        expect(markdown).toContain("> Quoted **claim**");
        expect(markdown).toContain("1. First");
        expect(markdown).toContain("    - Nested");
        expect(markdown).toContain("[the docs](https://example.com/docs)");
        expect(markdown).toContain("`npm test`");
        expect(markdown).toContain("```\nconst safe = true;\n```");
    });

    test("drops media, executable elements, unsafe links, and presentation attributes", () => {
        const html = `
            <p id="private" class="remote" style="color: red; font-size: 40px">
                Safe <a href="javascript:alert(1)" style="color: blue">label</a>
                <img src="private.png"><script>alert(1)</script><iframe src="https://example.com"></iframe>
            </p>
        `;

        const document = sanitizeRichPasteDocument(html);
        const paragraph = document.body.querySelector("p");

        expect(document.body.querySelector("img, script, iframe")).toBeNull();
        expect(document.body.querySelector("a")).toBeNull();
        expect(paragraph?.textContent?.replace(/\s+/g, " ").trim()).toBe("Safe label");
        expect(paragraph?.attributes).toHaveLength(0);
        expect(importHtmlAsMarkdown(html).trim()).toBe("Safe label");
    });

    test("does not turn numbered prose into a list", () => {
        expect(importHtmlAsMarkdown("<p>10. Situación política hipotética</p>").trim()).toBe("10. Situación política hipotética");
    });

    test("recognizes Word numbered lists and preserves genuine internal line breaks", () => {
        const html = `
            <p class="MsoListParagraphCxSpFirst" style="mso-list: l2 level1 lfo2"><span style="mso-list: Ignore">1.&nbsp;</span>First</p>
            <p class="MsoListParagraphCxSpLast" style="mso-list: l2 level1 lfo2"><span style="mso-list: Ignore">2.&nbsp;</span>Second</p>
            <p>Line one<br>line two</p>
        `;

        const markdown = importHtmlAsMarkdown(html);

        expect(markdown).toContain("1. First\n2. Second");
        expect(markdown).toContain("Line one\nline two");
        expect(normalizeMarkdown(markdown)).toBe(markdown);
    });
});
