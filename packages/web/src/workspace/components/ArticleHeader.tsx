import { useEffect, useRef, useState } from "react";
import type { Article } from "@skladno/shared";
import { Button, Field, Select } from "../../ui/primitives.js";

export function ArticleHeader({ article, rename, save, remove, focusMode, setFocusMode, language, setLanguage }: {
    article: Article;
    rename: (articleId: string, title: string) => Promise<void>;
    save: () => Promise<unknown>;
    remove: (articleId: string) => Promise<void>;
    focusMode: boolean;
    setFocusMode: (value: boolean) => void;
    language: string;
    setLanguage: (language: string) => void;
}) {
    const [title, setTitle] = useState(article.title);
    const [editingTitle, setEditingTitle] = useState(false);
    const renameTimer = useRef<ReturnType<typeof setTimeout>>();
    const pendingTitle = useRef<string>();
    const workflowStages = ["Talking points", "Narrative", "Author edit", "Flow", "Facts", "Style", "Translate", "Publish"];

    useEffect(() => {
        setTitle(article.title);
        setEditingTitle(false);
        pendingTitle.current = undefined;
        clearTimeout(renameTimer.current);
    }, [article.id, article.title]);


    useEffect(() => () => clearTimeout(renameTimer.current), []);


    function persistTitle(value: string) {
        const nextTitle = value.trim();

        if (!nextTitle || nextTitle === article.title || nextTitle === pendingTitle.current)
            return;

        pendingTitle.current = nextTitle;

        void rename(article.id, nextTitle)
            .catch(() => setTitle(article.title))
            .finally(() => {
                if (pendingTitle.current === nextTitle)
                    pendingTitle.current = undefined;
            });
    }


    function queueTitleSave(value: string) {
        clearTimeout(renameTimer.current);
        renameTimer.current = setTimeout(() => persistTitle(value), 500);
    }


    function finishTitleEditing() {
        clearTimeout(renameTimer.current);
        persistTitle(title);
        setEditingTitle(false);

        if (!title.trim())
            setTitle(article.title);
    }

    return <header className="border-b border-border bg-surface-raised">
        <div className="flex min-h-16 items-center gap-3 px-5">
            <h1 className={editingTitle ? "min-w-0 flex-1 text-xl font-semibold tracking-tight" : "min-w-0 text-xl font-semibold tracking-tight"}>
                {editingTitle
                    ? <Field
                        autoFocus
                        aria-label="Article title"
                        className="h-10 min-h-10 w-full px-2 text-xl font-semibold tracking-tight"
                        value={title}
                        onBlur={finishTitleEditing}
                        onChange={(event) => {
                            setTitle(event.target.value);
                            queueTitleSave(event.target.value);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter")
                                event.currentTarget.blur();

                            if (event.key === "Escape") {
                                clearTimeout(renameTimer.current);
                                setTitle(article.title);
                                setEditingTitle(false);
                            }
                        }}
                    />
                    : <button className="max-w-md truncate text-left hover:text-brand focus:outline-none" type="button" aria-label={`Rename article: ${article.title}`} onClick={() => setEditingTitle(true)}>{article.title}</button>}
            </h1>
            <div className="ml-auto flex shrink-0 items-center gap-2">
                <Select className="min-h-9 !w-28 py-1.5 text-xs" aria-label="Target language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                    <option>Spanish</option>
                    <option>English</option>
                    <option>Portuguese</option>
                </Select>
                <Button variant="secondary" onClick={() => void save()}>Save revision</Button>
                <Button variant="quiet" onClick={() => setFocusMode(!focusMode)}>{focusMode ? "Leave focus mode" : "Focus mode"}</Button>
                <Button variant="danger" onClick={() => void remove(article.id)}>Delete article</Button>
            </div>
        </div>
        <div className="flex min-h-10 items-end gap-5 overflow-x-auto px-5 text-xs text-muted" aria-label="Suggested editorial workflow">
            {workflowStages.map((stage) => <span key={stage} className={stage === "Flow" ? "border-b-2 border-brand py-3 font-semibold text-brand" : "py-3"}>{stage}</span>)}
        </div>
    </header>;
}
