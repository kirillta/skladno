import { useState } from "react";
import type { Article } from "@skladno/shared";
import { Button, Field } from "../../ui/primitives.js";

export function ArticleLibraryPanel({ articles, selectedArticleId, selectArticle, collapsed, setCollapsed, openCreate }: { 
    articles: Article[]; 
    selectedArticleId: string | undefined; 
    selectArticle: (articleId: string) => void; 
    collapsed: boolean; 
    setCollapsed: (value: boolean) => void; 
    openCreate: () => void 
}) {
    const [query, setQuery] = useState("");
    const visibleArticles = articles.filter((article) => article.title.toLowerCase().includes(query.toLowerCase()));

    return <aside className={collapsed ? "w-12 border-r border-border p-1" : "w-64 border-r border-border p-3"} aria-label="Article Library Panel">
        <Button variant="quiet" aria-label="Toggle Article Library Panel" onClick={() => setCollapsed(!collapsed)}>☰</Button>
        {!collapsed && <>
            <div className="mt-3 flex gap-2">
                <Field aria-label="Search articles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles" />
                <Button onClick={openCreate}>New article</Button>
            </div>
            <nav className="mt-3 space-y-1" aria-label="Article library">
                {visibleArticles.map((article) => <button key={article.id} onClick={() => selectArticle(article.id)} className={`w-full rounded-control p-2 text-left text-sm ${article.id === selectedArticleId ? "bg-brand-soft text-brand" : "hover:bg-surface-raised"}`}>{article.title}</button>)}
            </nav>
        </>}
    </aside>;
}
