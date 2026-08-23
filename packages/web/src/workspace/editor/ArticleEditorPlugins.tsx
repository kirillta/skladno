import { useEffect, useRef } from "react";
import { $generateNodesFromDOM } from "@lexical/html";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, CLEAR_HISTORY_COMMAND, COMMAND_PRIORITY_CRITICAL, PASTE_COMMAND, type LexicalEditor } from "lexical";
import { exportArticleMarkdown, importArticleMarkdown } from "./markdown.js";
import { sanitizeRichPasteDocument } from "./paste.js";


export function EditorBridge({ content, onChange, onReady }: { content: string; onChange: (value: string) => void; onReady: (editor: LexicalEditor) => void }) {
    const [editor] = useLexicalComposerContext();
    const emitted = useRef(content);
    const initialContent = useRef(content);

    useEffect(() => {
        onReady(editor);
        editor.update(() => importArticleMarkdown(initialContent.current), { tag: "article-initial" });
    }, [editor, onReady]);

    useEffect(() => {
        if (content === emitted.current)
            return;

        emitted.current = content;
        editor.update(() => importArticleMarkdown(content), { tag: "article-external" });
        editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
    }, [content, editor]);

    return <OnChangePlugin ignoreSelectionChange onChange={(state, changedEditor, tags) => {
        if (tags.has("article-initial") || tags.has("article-external"))
            return;

        state.read(() => {
            const markdown = exportArticleMarkdown();
            if (markdown !== emitted.current) {
                emitted.current = markdown;
                onChange(markdown);
            }
        });
    }} />;
}


export function EditorSelectionBridge({ onSelectionChange }: { onSelectionChange?: (value: string | undefined) => void }) {
    return <OnChangePlugin ignoreHistoryMergeTagChange ignoreSelectionChange={false} onChange={(state) => {
        state.read(() => {
            const selection = $getSelection();
            const text = $isRangeSelection(selection) ? selection.getTextContent() : "";
            if (text)
                onSelectionChange?.(text);
        });
    }} />;
}


const assistantSelectionHighlight = "skladno-assistant-selection";


export function AssistantSelectionHighlight({ active }: { active: boolean }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const highlights = (globalThis.CSS as typeof CSS & { highlights?: { delete(name: string): void; set(name: string, value: unknown): void } } | undefined)?.highlights;
        const HighlightConstructor = (globalThis as typeof globalThis & { Highlight?: new (range: Range) => unknown }).Highlight;
        if (!highlights || !HighlightConstructor)
            return;

        if (!active) {
            highlights.delete(assistantSelectionHighlight);
            return;
        }

        const captureSelection = () => {
            const selection = window.getSelection();
            const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
            const root = editor.getRootElement();
            if (!range || !root?.contains(range.commonAncestorContainer))
                return;

            highlights.set(assistantSelectionHighlight, new HighlightConstructor(range.cloneRange()));
        };

        captureSelection();
        return editor.registerUpdateListener(captureSelection);
    }, [active, editor]);

    useEffect(() => () => {
        (globalThis.CSS as typeof CSS & { highlights?: { delete(name: string): void } } | undefined)?.highlights?.delete(assistantSelectionHighlight);
    }, []);

    return null;
}


export function SupportedPastePlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => editor.registerCommand(PASTE_COMMAND, (event) => {
        const clipboard = event instanceof ClipboardEvent
            ? event.clipboardData
            : null;
        const html = clipboard?.getData("text/html") ?? "";
        if (!clipboard || !html)
            return false;

        event.preventDefault();
        const plainText = clipboard.getData("text/plain");
        const usePlainText = html.length > 250_000;

        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection))
                return;

            if (usePlainText) {
                selection.insertText(plainText);
                return;
            }

            const document = sanitizeRichPasteDocument(html);
            selection.insertNodes($generateNodesFromDOM(editor, document));
        });

        return true;
    }, COMMAND_PRIORITY_CRITICAL), [editor]);

    return null;
}
