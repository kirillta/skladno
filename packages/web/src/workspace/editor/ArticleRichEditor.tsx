import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $createCodeNode, CodeNode } from "@lexical/code";
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $createParagraphNode, $getSelection, $isRangeSelection, CLEAR_HISTORY_COMMAND, FORMAT_TEXT_COMMAND, type ElementNode, type LexicalEditor } from "lexical";
import { Button, Dialog, Field } from "../../ui/primitives.js";
import { $generateNodesFromMarkdownString } from "@lexical/markdown";
import { exportArticleMarkdown, importArticleMarkdown, articleMarkdownTransformers } from "./markdown.js";
import { sanitizeRichPaste } from "./paste.js";
import { BoldIcon, CodeIcon, ItalicIcon, LinkIcon, ListIcon, NumberedListIcon, StrikeIcon } from "./icons.js";

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote" | "code";
const validUrl = (value: string) => /^(https?:|mailto:)/i.test(value.trim());


function EditorErrorBoundary({ children }: { children: ReactNode }) {
    return <>{children}</>;
}


function EditorBridge({ content, onChange, onReady }: { content: string; onChange: (value: string) => void; onReady: (editor: LexicalEditor) => void }) {
    const [editor] = useLexicalComposerContext();
    const emitted = useRef(content);

    useEffect(() => {
        onReady(editor);
        editor.update(() => importArticleMarkdown(content), { tag: "article-initial" });
    }, [editor, onReady]);

    useEffect(() => {
        if (content === emitted.current)
        {
            return;
        }

        emitted.current = content;
        editor.update(() => importArticleMarkdown(content), { tag: "article-external" });
        editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
    }, [content, editor]);

    return <OnChangePlugin ignoreSelectionChange onChange={(state, changedEditor, tags) => {
        if (tags.has("article-initial") || tags.has("article-external"))
        {
            return;
        }

        state.read(() => {
            const markdown = exportArticleMarkdown();
            if (markdown !== emitted.current) {
                emitted.current = markdown;
                onChange(markdown);
            }
        });
    }} />;
}


function $setBlockType(type: BlockType) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection))
    {
        return;
    }

    const block = selection.anchor.getNode().getTopLevelElementOrThrow();
    let replacement: ElementNode = $createParagraphNode();

    if (type.startsWith("h"))
    {
        replacement = $createHeadingNode(type as "h1");
    }

    if (type === "quote")
    {
        replacement = $createQuoteNode();
    }

    if (type === "code")
    {
        replacement = $createCodeNode();
    }

    block.replace(replacement, true);
}


function currentBlock(editor: LexicalEditor): BlockType {
    let value: BlockType = "paragraph";
    editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection))
        {
            return;
        }

        const node = selection.anchor.getNode().getTopLevelElementOrThrow();
        if ($isHeadingNode(node))
        {
            value = node.getTag() as BlockType;
        }
        else if ($isQuoteNode(node))
        {
            value = "quote";
        }
        else if (node instanceof CodeNode)
        {
            value = "code";
        }
    });

    return value;
}


function Toolbar({ editor, openLink }: { editor: LexicalEditor; openLink: () => void }) {
    const [block, setBlock] = useState<BlockType>("paragraph");
    const [formats, setFormats] = useState<Set<string>>(new Set());

    useEffect(() => editor.registerUpdateListener(() => editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection))
        {
            setFormats(new Set(["bold", "italic", "strikethrough", "code"].filter((format) => selection.hasFormat(format as "bold"))));
        }

        setBlock(currentBlock(editor));
    })), [editor]);

    const activate = (action: () => void) => {
        action();
        editor.focus();
    };

    const keyNav = (event: KeyboardEvent<HTMLDivElement>) => {
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button,select")];
        const index = items.indexOf(document.activeElement as HTMLElement);

        if (event.key === "Home")
        {
            event.preventDefault();
            items[0]?.focus();
        }

        if (event.key === "End")
        {
            event.preventDefault();
            items.at(-1)?.focus();
        }

        if (event.key === "ArrowRight" || event.key === "ArrowLeft")
        {
            event.preventDefault();
            items[(index + (event.key === "ArrowRight" ? 1 : items.length - 1)) % items.length]?.focus();
        }
    };

    const controls = [
        ["Bold", BoldIcon, "bold"], ["Italic", ItalicIcon, "italic"], ["Strikethrough", StrikeIcon, "strikethrough"], ["Inline code", CodeIcon, "code"],
    ] as const;

    return <div className="shrink-0 overflow-x-auto border-b border-border bg-surface-raised px-4 py-1 [scrollbar-width:thin]">
        <div role="toolbar" aria-label="Article formatting" onKeyDown={keyNav} className="flex w-max min-w-full items-center gap-1">
            <select aria-label="Block style"
                value={block}
                onChange={(event) => activate(() => editor.update(() => $setBlockType(event.target.value as BlockType)))}
                className="min-h-9 rounded-control border border-border bg-surface-raised px-2 text-xs text-ink">
                <option value="paragraph">Paragraph</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="h4">Heading 4</option>
                <option value="h5">Heading 5</option>
                <option value="h6">Heading 6</option>
                <option value="quote">Block quote</option>
                <option value="code">Code block</option>
            </select>
            {controls.map(([label, Icon, format]) => <button key={format} type="button" aria-label={label} aria-pressed={formats.has(format)} onMouseDown={(event) => event.preventDefault()} onClick={() => activate(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format))} className="grid size-9 place-items-center rounded-control text-brand hover:bg-brand-soft"><Icon /></button>)}
            <button type="button"
                aria-label="Link"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => activate(openLink)}
                className="grid size-9 place-items-center rounded-control text-brand hover:bg-brand-soft">
                <LinkIcon />
            </button>
            <button type="button"
                aria-label="Bulleted list"
                aria-pressed={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => activate(() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined))}
                className="grid size-9 place-items-center rounded-control text-brand hover:bg-brand-soft">
                <ListIcon />
            </button>
            <button type="button"
                aria-label="Numbered list"
                aria-pressed={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => activate(() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined))}
                className="grid size-9 place-items-center rounded-control text-brand hover:bg-brand-soft">
                <NumberedListIcon />
            </button>
        </div>
    </div>;
}


function LinkDialog({ editor, close }: { editor: LexicalEditor; close: () => void }) {
    const [text, setText] = useState("");
    const [url, setUrl] = useState("");
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection))
        {
            return;
        }

        const link = selection.anchor.getNode().getParents().find($isLinkNode);
        if (link)
        {
            setEditing(true);
            setText(link.getTextContent());
            setUrl(link.getURL());
        }
        else
        {
            setText(selection.getTextContent());
        }
    }), [editor]
    );

    function apply() {
        if (!validUrl(url))
        {
            setError("Use an http:, https:, or mailto: URL.");
            return;
        }

        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection))
            {
                return;
            }

            if (selection.isCollapsed())
            {
                selection.insertText(text || url.trim());
            }

            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
        });

        close();
        editor.focus();
    }

    return <Dialog open aria-labelledby="link-dialog-title">
        <h2 id="link-dialog-title" className="text-base font-semibold">{editing ? "Edit link" : "Add link"}</h2>
        <label className="mt-4 block text-xs font-semibold">Link text<Field value={text} onChange={(event) => setText(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-semibold">URL<Field value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => {
                close();
                editor.focus();
            }}>Cancel</Button>
            {editing && <Button variant="danger" onClick={() => {
                editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                close();
                editor.focus();
            }}>Remove link</Button>}
            <Button onClick={apply}>Apply</Button>
        </div>
    </Dialog>;
}


function LinkControl({ editor }: { editor: LexicalEditor }) {
    const [open, setOpen] = useState(false);
    const openLink = useCallback(async () => {
        let clipboard = "";

        try {
            clipboard = await navigator.clipboard.readText();
        } catch {
            setOpen(true);
            return;
        }

        let selected = false;
        editor.getEditorState().read(() => {
            const selection = $getSelection();
            selected = $isRangeSelection(selection) && !selection.isCollapsed();
        });

        if (!validUrl(clipboard))
        {
            setOpen(true);
            return;
        }

        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection))
            {
                return;
            }

            if (!selected)
            {
                selection.insertText(clipboard.trim());
            }

            editor.dispatchCommand(TOGGLE_LINK_COMMAND, clipboard.trim());
        });

        editor.focus();
    }, [editor]);

    return <>{open && <LinkDialog editor={editor} close={() => setOpen(false)} />}
        <Toolbar editor={editor} openLink={openLink} />
    </>;
}


function EditorContents({ content, onChange }: { content: string; onChange: (value: string) => void }) {
    const [editor, setEditor] = useState<LexicalEditor>();
    function paste(event: ClipboardEvent<HTMLDivElement>) {
        const html = event.clipboardData.getData("text/html");
        if (!html || !editor)
        {
            return;
        }

        event.preventDefault();
        const markdown = sanitizeRichPaste(html);
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection))
            {
                selection.insertNodes($generateNodesFromMarkdownString(markdown, articleMarkdownTransformers, true));
            }
        });
    }

    return <>{editor && <LinkControl editor={editor} />}
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <div className="min-h-full px-8 py-7">
                <div className="relative mx-auto w-full max-w-3xl">
                    <RichTextPlugin contentEditable={<ContentEditable aria-label="Article draft" onPaste={paste} className="min-h-[calc(100vh-16rem)] whitespace-pre-wrap font-editor text-xl leading-8 text-ink outline-none [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:font-mono [&_h1]:text-4xl [&_h2]:text-3xl [&_h3]:text-2xl" />} placeholder={<p className="pointer-events-none absolute top-0 text-xl text-muted">Write your article...</p>} ErrorBoundary={EditorErrorBoundary} />
                    <HistoryPlugin />
                    <ListPlugin />
                    <LinkPlugin />
                    <EditorBridge content={content} onChange={onChange} onReady={setEditor} />
                </div>
            </div>
        </div>
    </>;
}


export function ArticleRichEditor({ articleId, content, setContent }: { articleId: string; content: string; setContent: (value: string) => void }) {
    const config = useMemo(() => ({
        namespace: `skladno-article-${articleId}`,
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode],
        onError: (error: Error) => { throw error; }
    }),
        [articleId]
    );

    return <LexicalComposer key={articleId} initialConfig={config}>
        <div className="flex h-full min-h-0 flex-col">
            <EditorContents content={content} onChange={setContent} />
        </div>
    </LexicalComposer>;
}
