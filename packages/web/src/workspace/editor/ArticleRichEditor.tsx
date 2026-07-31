import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
import { $insertList, $isListNode, $removeList, ListItemNode, ListNode, type ListType } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $createParagraphNode, $getSelection, $isElementNode, $isRangeSelection, $setSelection, CLEAR_HISTORY_COMMAND, COMMAND_PRIORITY_CRITICAL, PASTE_COMMAND, type BaseSelection, type EditorThemeClasses, type ElementNode, type LexicalEditor, type TextFormatType } from "lexical";
import { Button, Dialog, Field } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { $generateNodesFromDOM } from "@lexical/html";
import { exportArticleMarkdown, importArticleMarkdown } from "./markdown.js";
import { isSupportedArticleLink } from "./paste-constants.js";
import { sanitizeRichPasteDocument } from "./paste.js";
import { BoldIcon, CodeIcon, ItalicIcon, LinkIcon, ListIcon, NumberedListIcon, StrikeIcon } from "./icons.js";

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote" | "code";
const articleEditorTheme: EditorThemeClasses = {
    text: {
        bold: "font-bold",
        code: "rounded-control bg-surface px-1 font-mono text-base",
        italic: "italic",
        strikethrough: "line-through",
    },
    list: {
        listitem: "my-1",
        ol: "list-decimal pl-7",
        ul: "list-disc pl-7",
    },
};


function EditorErrorBoundary({ children }: { children: ReactNode }) {
    return <>{children}</>;
}


function EditorBridge({ content, onChange, onReady }: { content: string; onChange: (value: string) => void; onReady: (editor: LexicalEditor) => void }) {
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


function $setBlockType(type: BlockType) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection))
        return;

    const blocks = new Map<string, ElementNode>();
    for (const node of selection.getNodes()) {
        const block = node.getTopLevelElementOrThrow();
        if (!$isElementNode(block))
            continue;

        blocks.set(block.getKey(), block);
    }

    for (const block of blocks.values()) {
        let replacement: ElementNode = $createParagraphNode();

        if (type.startsWith("h"))
            replacement = $createHeadingNode(type as "h1");

        if (type === "quote")
            replacement = $createQuoteNode();

        if (type === "code")
            replacement = $createCodeNode();

        block.replace(replacement, true);
    }
}


function currentBlock(editor: LexicalEditor): BlockType {
    let value: BlockType = "paragraph";
    editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection))
            return;

        const node = selection.anchor.getNode().getTopLevelElementOrThrow();
        if ($isHeadingNode(node))
            value = node.getTag() as BlockType;
        else if ($isQuoteNode(node))
            value = "quote";
        else if (node instanceof CodeNode)
            value = "code";
    });

    return value;
}


function currentListType(editor: LexicalEditor): ListType | undefined {
    let value: ListType | undefined;
    editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection))
            return;

        const node = selection.anchor.getNode();
        const list = $isListNode(node)
            ? node
            : node.getParents().find($isListNode);
        value = list?.getListType();
    });

    return value;
}


function Toolbar({ editor, openLink }: { editor: LexicalEditor; openLink: () => void }) {
    const intl = useIntl();
    const [block, setBlock] = useState<BlockType>("paragraph");
    const [formats, setFormats] = useState<Set<string>>(new Set());
    const [listType, setListType] = useState<ListType>();
    const [linkActive, setLinkActive] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const savedBlockSelection = useRef<BaseSelection | null>(null);

    useEffect(() => editor.registerUpdateListener(() => editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            setFormats(new Set(["bold", "italic", "strikethrough", "code"].filter((format) => selection.hasFormat(format as "bold"))));

            const node = selection.anchor.getNode();
            const link = $isLinkNode(node)
                ? node
                : node.getParents().find($isLinkNode);
            const url = link?.getURL() ?? "";

            setLinkActive(Boolean(link));
            setLinkUrl(isSupportedArticleLink(url) ? url : "");
        } else {
            setLinkActive(false);
            setLinkUrl("");
        }

        setBlock(currentBlock(editor));
        setListType(currentListType(editor));
    })), [editor]);

    const activate = (action: () => void) => {
        action();
        editor.focus();
    };

    function rememberBlockSelection() {
        editor.getEditorState().read(() => {
            const selection = $getSelection();
            savedBlockSelection.current = selection?.clone() ?? null;
        });
    }

    function applyBlockType(type: BlockType) {
        editor.update(() => {
            if (savedBlockSelection.current)
                $setSelection(savedBlockSelection.current.clone());

            $setBlockType(type);
        });

        savedBlockSelection.current = null;
        editor.focus();
    }

    function applyTextFormat(format: TextFormatType) {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection))
                selection.formatText(format);
        });

        editor.focus();
    }

    function applyList(type: ListType) {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection))
                return;

            const node = selection.anchor.getNode();
            const list = $isListNode(node)
                ? node
                : node.getParents().find($isListNode);

            if (list?.getListType() === type)
                $removeList();
            else
                $insertList(type);
        });

        editor.focus();
    }

    const keyNav = (event: KeyboardEvent<HTMLDivElement>) => {
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>("a,button,select")];
        const index = items.indexOf(document.activeElement as HTMLElement);

        if (event.key === "Home") {
            event.preventDefault();
            items[0]?.focus();
        }

        if (event.key === "End") {
            event.preventDefault();
            items.at(-1)?.focus();
        }

        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            items[(index + (event.key === "ArrowRight" ? 1 : items.length - 1)) % items.length]?.focus();
        }
    };

    const controls = [
        ["editor.bold", BoldIcon, "bold"], ["editor.italic", ItalicIcon, "italic"], ["editor.strikethrough", StrikeIcon, "strikethrough"], ["editor.codeBlock", CodeIcon, "code"],
    ] as const;

    const formatButtonClass = (active: boolean) => [
        "grid size-9 place-items-center rounded-control border text-brand transition-colors",
        active ? "border-brand bg-brand-soft shadow-raised" : "border-transparent hover:bg-brand-soft",
    ].join(" ");

    return <div className="shrink-0 overflow-x-auto border-b border-border bg-surface-raised px-4 py-1 [scrollbar-width:thin]">
        <div role="toolbar" aria-label={intl.formatMessage({ id: "editor.formatting" })} onKeyDown={keyNav} className="flex w-max min-w-full items-center gap-1">
            <select aria-label={intl.formatMessage({ id: "editor.blockStyle" })}
                value={block}
                onMouseDown={rememberBlockSelection}
                onChange={(event) => applyBlockType(event.target.value as BlockType)}
                className="min-h-9 rounded-control border border-border bg-surface-raised px-2 text-xs text-ink">
                <option value="paragraph">{intl.formatMessage({ id: "editor.paragraph" })}</option>
                {[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={`h${level}`}>{intl.formatMessage({ id: "editor.heading" }, { level })}</option>)}
                <option value="quote">{intl.formatMessage({ id: "editor.blockQuote" })}</option>
                <option value="code">{intl.formatMessage({ id: "editor.codeBlock" })}</option>
            </select>
            {controls.map(([label, Icon, format]) => <button key={format} type="button" aria-label={intl.formatMessage({ id: label as "editor.bold" | "editor.italic" | "editor.strikethrough" | "editor.codeBlock" })} aria-pressed={formats.has(format)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextFormat(format)} className={formatButtonClass(formats.has(format))}><Icon /></button>)}
            <button type="button"
                aria-label={intl.formatMessage({ id: "editor.link" })}
                aria-pressed={linkActive}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => activate(openLink)}
                className={formatButtonClass(linkActive)}>
                <LinkIcon />
            </button>
            {linkUrl && <a href={linkUrl} target="_blank" rel="noreferrer" aria-label={intl.formatMessage({ id: "editor.openLink" }, { url: linkUrl })} className="inline-flex min-h-9 max-w-32 items-center truncate rounded-control px-2 text-xs font-semibold text-brand underline underline-offset-2 hover:bg-brand-soft">{linkUrl}</a>}
            <button type="button"
                aria-label={intl.formatMessage({ id: "editor.bulletedList" })}
                aria-pressed={listType === "bullet"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyList("bullet")}
                className={formatButtonClass(listType === "bullet")}>
                <ListIcon />
            </button>
            <button type="button"
                aria-label={intl.formatMessage({ id: "editor.numberedList" })}
                aria-pressed={listType === "number"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyList("number")}
                className={formatButtonClass(listType === "number")}>
                <NumberedListIcon />
            </button>
        </div>
    </div>;
}


function LinkDialog({ editor, close }: { editor: LexicalEditor; close: () => void }) {
    const intl = useIntl();
    const [text, setText] = useState("");
    const [url, setUrl] = useState("");
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection))
            return;

        const link = selection.anchor.getNode().getParents().find($isLinkNode);
        if (link) {
            setEditing(true);
            setText(link.getTextContent());
            setUrl(link.getURL());
        } else {
            setText(selection.getTextContent());
        }
    }), [editor]
    );

    function apply() {
        if (!isSupportedArticleLink(url)) {
            setError("Use an http:, https:, or mailto: URL.");
            return;
        }

        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection))
                return;

            if (selection.isCollapsed())
                selection.insertText(text || url.trim());

            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
        });

        close();
        editor.focus();
    }

    return <Dialog open aria-labelledby="link-dialog-title" className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl">
        <h2 id="link-dialog-title" className="text-base font-semibold">{editing ? intl.formatMessage({ id: "editor.link" }) : intl.formatMessage({ id: "editor.link" })}</h2>
        <label className="mt-4 block text-xs font-semibold">{intl.formatMessage({ id: "editor.linkText" })}<Field value={text} onChange={(event) => setText(event.target.value)} /></label>
        <label className="mt-3 block text-xs font-semibold">{intl.formatMessage({ id: "editor.url" })}<Field value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => {
                close();
                editor.focus();
            }}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            {editing && <Button variant="danger" onClick={() => {
                editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                close();
                editor.focus();
            }}>{intl.formatMessage({ id: "editor.removeLink" })}</Button>}
            <Button onClick={apply}>{intl.formatMessage({ id: "editor.apply" })}</Button>
        </div>
    </Dialog>;
}


function LinkControl({ editor }: { editor: LexicalEditor }) {
    const [open, setOpen] = useState(false);
    const openLink = useCallback(async () => {
        let selected = false;
        let editing = false;
        editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection))
                return;

            selected = !selection.isCollapsed();
            const node = selection.anchor.getNode();
            editing = $isLinkNode(node) || node.getParents().some($isLinkNode);
        });

        if (editing) {
            setOpen(true);
            return;
        }

        let clipboard = "";

        try {
            clipboard = await navigator.clipboard.readText();
        } catch {
            setOpen(true);
            return;
        }

        if (!isSupportedArticleLink(clipboard)) {
            setOpen(true);
            return;
        }

        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection))
                return;

            if (!selected)
                selection.insertText(clipboard.trim());

            editor.dispatchCommand(TOGGLE_LINK_COMMAND, clipboard.trim());
        });

        editor.focus();
    }, [editor]);

    return <>{open && <LinkDialog editor={editor} close={() => setOpen(false)} />}
        <Toolbar editor={editor} openLink={openLink} />
    </>;
}


function SupportedPastePlugin() {
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


function EditorContents({ content, onChange }: { content: string; onChange: (value: string) => void }) {
    const intl = useIntl();
    const [editor, setEditor] = useState<LexicalEditor>();
    return <>{editor && <LinkControl editor={editor} />}
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <div className="min-h-full px-8 py-7">
                <div className="relative mx-auto w-full max-w-3xl">
                    <RichTextPlugin contentEditable={<ContentEditable aria-label={intl.formatMessage({ id: "editor.articleDraft" })} className="min-h-[calc(100vh-16rem)] whitespace-pre-wrap font-editor text-xl leading-8 text-ink outline-none [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:font-mono [&_h1]:text-4xl [&_h2]:text-3xl [&_h3]:text-2xl [&_h4]:text-xl [&_h4]:font-bold [&_h4]:leading-7 [&_h5]:text-lg [&_h5]:font-bold [&_h5]:leading-7 [&_h6]:text-base [&_h6]:font-bold [&_h6]:uppercase [&_h6]:tracking-wide [&_h6]:leading-6" />} placeholder={<p className="pointer-events-none absolute top-0 text-xl text-muted">{intl.formatMessage({ id: "editor.placeholder" })}</p>} ErrorBoundary={EditorErrorBoundary} />
                    <HistoryPlugin />
                    <ListPlugin />
                    <LinkPlugin />
                    <SupportedPastePlugin />
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
        theme: articleEditorTheme,
        onError: (error: Error) => {
            throw error;
        }
    }),
    [articleId]
    );

    return <LexicalComposer key={articleId} initialConfig={config}>
        <div className="flex h-full min-h-0 flex-col">
            <EditorContents content={content} onChange={setContent} />
        </div>
    </LexicalComposer>;
}
