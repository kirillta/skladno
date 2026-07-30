import type { Article } from "@skladno/shared";
import { Button } from "../../ui/primitives.js";

export function ArticleHeader({ article, save, remove, focusMode, setFocusMode }: { 
    article: Article; 
    save: () => Promise<unknown>; 
    remove: (articleId: string) => Promise<void>; 
    focusMode: boolean; 
    setFocusMode: (value: boolean) => void 
}) {
    return <header className="flex min-h-16 items-center gap-3 border-b border-border bg-surface-raised px-5">
        <h1 className="truncate text-lg font-semibold">{article.title}</h1>
        <span className="text-xs text-muted">Revision {article.currentRevisionId.slice(0, 8)}</span>
        <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => void save()}>Save revision</Button>
            <Button variant="quiet" onClick={() => setFocusMode(!focusMode)}>{focusMode ? "Leave focus mode" : "Focus mode"}</Button>
            <Button variant="danger" onClick={() => void remove(article.id)}>Delete article</Button>
        </div>
    </header>;
}
