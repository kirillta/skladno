import { useEffect, useRef } from "react";
import { $generateNodesFromDOM } from "@lexical/html";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createRangeSelection, $getRoot, $getSelection, $isElementNode, $isRangeSelection, $setSelection, CLEAR_HISTORY_COMMAND, COMMAND_PRIORITY_CRITICAL, createEditor, PASTE_COMMAND, type LexicalEditor, type LexicalNode, type RangeSelection } from "lexical";
import { articleEditorNodes } from "./article-editor-config.js";
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
        if (tags.has("article-initial") || tags.has("article-external") || tags.has("assistant-selection-capture") || tags.has("assistant-selection-restore"))
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


export interface AssistantSelectionSnapshot {
    markdown: string;
    preview: string;
    startOffset: number;
    endOffset: number;
}


export function captureAssistantSelection(editor: LexicalEditor, selection: RangeSelection): AssistantSelectionSnapshot | undefined {
    const originalState = editor.getEditorState();
    const boundaries = selection.getStartEndPoints();
    if (!boundaries)
        return undefined;

    const nonce = crypto.randomUUID().replaceAll("-", "");
    const startMarker = `skladnoselectionstart${nonce}`;
    const endMarker = `skladnoselectionend${nonce}`;
    const boundaryPaths = originalState.read(() => boundaries.map((point) => {
        const path: number[] = [];
        let node = point.getNode();
        while (node.getParent()) {
            path.unshift(node.getIndexWithinParent());
            node = node.getParent()!;
        }

        return { path, offset: point.offset, type: point.type };
    }));
    const preview = originalState.read(() => selection.getTextContent());
    const snapshotEditor = createEditor({
        namespace: `assistant-selection-${nonce}`,
        nodes: articleEditorNodes,
        onError: (error) => {
            throw error;
        },
    });
    snapshotEditor.setEditorState(snapshotEditor.parseEditorState(originalState.toJSON()));
    let snapshot: AssistantSelectionSnapshot | undefined;

    snapshotEditor.update(() => {
        const insertAt = (boundary: typeof boundaryPaths[number], text: string) => {
            let node: LexicalNode = $getRoot();
            for (const index of boundary.path) {
                if (!$isElementNode(node))
                    return;

                const child = node.getChildAtIndex(index);
                if (!child)
                    return;

                node = child;
            }

            const cursor = $createRangeSelection();
            cursor.anchor.set(node.getKey(), boundary.offset, boundary.type);
            cursor.focus.set(node.getKey(), boundary.offset, boundary.type);
            $setSelection(cursor);
            cursor.insertText(text);
        };

        // Insert from right to left so the start point remains valid in its original node.
        insertAt(boundaryPaths[1], endMarker);
        insertAt(boundaryPaths[0], startMarker);
        const markdown = exportArticleMarkdown();
        const start = markdown.indexOf(startMarker);
        const end = markdown.indexOf(endMarker);
        if (start >= 0 && end > start)
            snapshot = {
                markdown: `${markdown.slice(0, start)}${markdown.slice(start + startMarker.length, end)}${markdown.slice(end + endMarker.length)}`,
                preview,
                startOffset: start,
                endOffset: end - startMarker.length,
            };
    }, { discrete: true, tag: "assistant-selection-capture" });

    return snapshot;
}


export function EditorSelectionBridge({ onSelectionChange }: { onSelectionChange?: (value: AssistantSelectionSnapshot | undefined) => void }) {
    const [editor] = useLexicalComposerContext();
    return <OnChangePlugin ignoreHistoryMergeTagChange ignoreSelectionChange={false} onChange={(state, _editor, tags) => {
        if (tags.has("assistant-selection-capture") || tags.has("assistant-selection-restore"))
            return;

        let selected: RangeSelection | undefined;
        state.read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && !selection.isCollapsed() && selection.getTextContent()) {
                selected = selection.clone();
                return;
            }

            if ($isRangeSelection(selection))
                onSelectionChange?.(undefined);
        });

        if (selected)
            onSelectionChange?.(captureAssistantSelection(editor, selected));
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
