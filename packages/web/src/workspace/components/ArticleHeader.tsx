import { useEffect, useRef, useState } from "react";
import { type Article, type KeyBindingOverrides, type UpdateArticleInput } from "@skladno/shared";
import { Button, Dialog, Field, IconButton } from "../../ui/primitives.js";
import { DeleteIcon, FocusIcon, LeaveFocusIcon, SaveIcon } from "../../ui/icons.js";
import { useIntl } from "react-intl";
import type { Notifications } from "../../notifications/notifications.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import { KEY_BINDING_COMMAND } from "@skladno/shared";


export function ArticleHeader(props: {
    article: Article;
    updateArticle: (articleId: string, input: UpdateArticleInput) => Promise<unknown>;
    save: () => Promise<unknown>;
    remove: (articleId: string) => Promise<void>;
    focusMode: boolean;
    setFocusMode: (value: boolean) => void;
    notifyError?: Notifications["notifyError"];
    shortcutOverrides?: KeyBindingOverrides;
}) {
    return <LocalizedArticleHeader {...props} />;
}


function LocalizedArticleHeader({ article, updateArticle, save, remove, focusMode, setFocusMode, notifyError, shortcutOverrides = {} }: Parameters<typeof ArticleHeader>[0]) {
    const intl = useIntl();
    const reportError = notifyError ?? (() => undefined);
    const [title, setTitle] = useState(article.title);
    const [editingTitle, setEditingTitle] = useState(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const renameTimer = useRef<ReturnType<typeof setTimeout>>();
    const pendingTitle = useRef<string>();
    const selectedArticleId = useRef(article.id);

    useEffect(() => {
        if (selectedArticleId.current === article.id)
            return;

        selectedArticleId.current = article.id;
        setTitle(article.title);
        setEditingTitle(false);
        setDeleteConfirmationOpen(false);
        pendingTitle.current = undefined;
        clearTimeout(renameTimer.current);
    }, [article.id, article.title]);

    useEffect(() => () => {
        clearTimeout(renameTimer.current);
    }, []);


    function persistTitle(value: string) {
        const nextTitle = value.trim();
        if (!nextTitle || nextTitle === article.title || nextTitle === pendingTitle.current)
            return;

        pendingTitle.current = nextTitle;
        void updateArticle(article.id, { title: nextTitle })
            .catch((error) => {
                setTitle(article.title);
                reportError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
            })
            .finally(() => {
                if (pendingTitle.current === nextTitle)
                    pendingTitle.current = undefined;
            });
    }


    function finishTitleEditing() {
        clearTimeout(renameTimer.current);
        persistTitle(title);
        setEditingTitle(false);
        if (!title.trim())
            setTitle(article.title);
    }


    async function confirmDelete() {
        try {
            await remove(article.id);
            setDeleteConfirmationOpen(false);
        } catch (error) {
            reportError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    return <header className="border-b border-border bg-surface">
        <div className="flex min-h-12 items-center gap-2 overflow-x-auto px-5 py-1.5">
            <h1 className={editingTitle ? "min-w-0 flex-1 text-xl font-semibold tracking-tight" : "min-w-0 flex-1 text-xl font-semibold tracking-tight"}>
                {editingTitle
                    ? <Field autoFocus aria-label={intl.formatMessage({ id: "articleHeader.title" })} className="h-10 min-h-10 w-full px-2 text-xl font-semibold tracking-tight" value={title} onBlur={finishTitleEditing} onChange={(event) => {
                        setTitle(event.target.value);
                        clearTimeout(renameTimer.current);
                        renameTimer.current = setTimeout(() => persistTitle(event.target.value), 500);
                    }} onKeyDown={(event) => {
                        if (event.key === "Enter")
                            event.currentTarget.blur();

                        if (event.key === "Escape") {
                            clearTimeout(renameTimer.current);
                            setTitle(article.title);
                            setEditingTitle(false);
                        }
                    }} />
                    : <button className="w-full truncate text-left hover:text-brand focus:outline-none" type="button" aria-label={intl.formatMessage({ id: "articleHeader.rename" }, { articleTitle: article.title })} onClick={() => setEditingTitle(true)}>{article.title}</button>}
            </h1>
            <div className="flex shrink-0 items-center gap-2 text-xs" aria-label={intl.formatMessage({ id: "articleHeader.metadata" })}>
                <IconButton className="text-muted hover:bg-brand-soft hover:text-brand" label={intl.formatMessage({ id: "articleHeader.saveRevision" })} title={shortcutHint(intl.formatMessage({ id: "articleHeader.saveRevision" }), KEY_BINDING_COMMAND.SAVE_REVISION, shortcutOverrides)} onClick={() => void save().catch(() => undefined)}>
                    <SaveIcon className="size-4" />
                </IconButton>
                <IconButton className="text-muted hover:bg-danger-soft hover:text-danger" label={intl.formatMessage({ id: "articleHeader.deleteArticle" })} title={intl.formatMessage({ id: "articleHeader.deleteArticle" })} onClick={() => setDeleteConfirmationOpen(true)}>
                    <DeleteIcon className="size-4" />
                </IconButton>
                <IconButton className="text-muted hover:bg-brand-soft hover:text-brand" label={intl.formatMessage({ id: focusMode ? "articleHeader.leaveFocusMode" : "articleHeader.focusMode" })} title={shortcutHint(intl.formatMessage({ id: focusMode ? "articleHeader.leaveFocusMode" : "articleHeader.focusMode" }), KEY_BINDING_COMMAND.TOGGLE_FOCUS_MODE, shortcutOverrides)} onClick={() => setFocusMode(!focusMode)}>
                    {focusMode ? <LeaveFocusIcon className="size-4" /> : <FocusIcon className="size-4" />}
                </IconButton>

            </div>
        </div>
        {deleteConfirmationOpen && <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="delete-article-title" onCancel={(event) => {
            event.preventDefault();
            setDeleteConfirmationOpen(false);
        }}>
            <h2 id="delete-article-title" className="text-lg font-semibold">{intl.formatMessage({ id: "articleHeader.deleteConfirmationTitle" })}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "articleHeader.deleteConfirmationDescription" }, { articleTitle: article.title })}</p>
            <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" autoFocus onClick={() => setDeleteConfirmationOpen(false)}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
                <Button variant="danger" onClick={() => void confirmDelete()}>{intl.formatMessage({ id: "articleHeader.confirmDeleteArticle" })}</Button>
            </div>
        </Dialog>}
    </header>;
}
