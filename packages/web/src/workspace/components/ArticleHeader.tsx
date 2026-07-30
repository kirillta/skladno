import type { Article } from "@skladno/shared";
import { Button, Select } from "../../ui/primitives.js";

export function ArticleHeader({ article, save, remove, focusMode, setFocusMode, language, setLanguage }: {
    article: Article; 
    save: () => Promise<unknown>; 
    remove: (articleId: string) => Promise<void>; 
    focusMode: boolean; 
    setFocusMode: (value: boolean) => void;
    language: string;
    setLanguage: (language: string) => void;
}) {
    const workflowStages = ["Talking points", "Narrative", "Author edit", "Flow", "Facts", "Style", "Translate", "Publish"];

    return <header className="border-b border-border bg-surface-raised">
        <div className="flex min-h-16 items-center gap-3 px-5">
            <h1 className="truncate text-xl font-semibold tracking-tight">{article.title}</h1>
            <span className="text-xs text-muted">Revision {article.currentRevisionId.slice(0, 8)}</span>
            <div className="ml-auto flex items-center gap-2">
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
