import { useCallback, useEffect, useState } from "react";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $getSelection, $isRangeSelection, type LexicalEditor } from "lexical";
import { useIntl } from "react-intl";
import { Button, Dialog, Field } from "../../ui/primitives.js";
import { isSupportedArticleLink } from "./paste-constants.js";
import { ArticleEditorToolbar } from "./ArticleEditorToolbar.js";


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
    }), [editor]);


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
        <label className="mt-4 block text-xs font-semibold">{intl.formatMessage({ id: "editor.linkText" })}
            <Field value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-semibold">{intl.formatMessage({ id: "editor.url" })}
            <Field value={url} onChange={(event) => setUrl(event.target.value)} />
        </label>
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


export function ArticleEditorLinkControl({ editor }: { editor: LexicalEditor }) {
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
        <ArticleEditorToolbar editor={editor} openLink={openLink} />
    </>;
}
