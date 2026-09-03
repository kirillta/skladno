import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { $createCodeNode, CodeNode } from "@lexical/code";
import { $isLinkNode } from "@lexical/link";
import { $insertList, $isListNode, $removeList, type ListType } from "@lexical/list";
import { $createParagraphNode, $getSelection, $isElementNode, $isRangeSelection, $setSelection, type BaseSelection, type ElementNode, type LexicalEditor, type TextFormatType } from "lexical";
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { useIntl } from "react-intl";
import { BoldIcon, CodeIcon, ItalicIcon, LinkIcon, ListIcon, NumberedListIcon, StrikeIcon } from "../../ui/icons.js";
import { isSupportedArticleLink } from "./paste-constants.js";


type BlockType = "paragraph" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote" | "code";


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


export function ArticleEditorToolbar({ editor, openLink }: { editor: LexicalEditor; openLink: () => void }) {
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
