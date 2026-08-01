import { useState } from "react";
import type { Article } from "@skladno/shared";
import { Button, Field, IconButton } from "../../ui/primitives.js";
import { ArticleIcon, SearchIcon, SettingsIcon, UserIcon } from "../../ui/icons.js";
import { useIntl } from "react-intl";


function formatUpdatedAt(updatedAt: string, formatMessage: ReturnType<typeof useIntl>["formatMessage"]): string {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000));

    if (elapsedMinutes < 1)
        return formatMessage({ id: "navigation.updatedJustNow" });

    if (elapsedMinutes < 60)
        return formatMessage({ id: "navigation.updatedMinutes" }, { count: elapsedMinutes });

    const elapsedHours = Math.floor(elapsedMinutes / 60);

    if (elapsedHours < 24)
        return formatMessage({ id: "navigation.updatedHours" }, { count: elapsedHours });

    const elapsedDays = Math.floor(elapsedHours / 24);

    return formatMessage({ id: "navigation.updatedDays" }, { count: elapsedDays });
}


function languageCode(language: string | undefined): string {
    const codes: Record<string, string> = {
        English: "EN",
        Spanish: "ES",
        Portuguese: "PT",
    };

    return language ? codes[language] ?? language.slice(0, 2).toUpperCase() : "EN";
}


export function ArticleLibraryPanel({ articles, selectedArticleId, selectArticle, collapsed, setCollapsed, createBlank, openStyleProfile, openSettings, language, saveState }: {
    articles: Article[];
    selectedArticleId: string | undefined;
    selectArticle: (articleId: string) => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    createBlank: () => Promise<unknown>;
    openStyleProfile: () => void;
    openSettings: () => void;
    language: string | undefined;
    saveState: "saved" | "saving" | "error"
}) {
    const intl = useIntl();
    const [query, setQuery] = useState("");
    const visibleArticles = articles.filter((article) => article.title.toLowerCase().includes(query.toLowerCase()));
    const saveLabel = saveState === "saved" ? intl.formatMessage({ id: "navigation.saved" }) : saveState === "saving" ? intl.formatMessage({ id: "navigation.saving" }) : intl.formatMessage({ id: "navigation.saveFailed" });
    const saveTone = saveState === "saved" ? "text-success" : saveState === "saving" ? "text-warning" : "text-danger";

    return <aside className={collapsed ? "flex h-full w-full flex-col border-r border-border bg-surface-supporting px-0.5 py-2" : "flex h-full w-full flex-col border-r border-border bg-surface-supporting"} aria-label={intl.formatMessage({ id: "navigation.articleLibrary" })}>
        {collapsed ? <>
            <header className="flex min-h-18 items-center justify-center">
                <IconButton className="text-base font-semibold text-brand" label={intl.formatMessage({ id: "navigation.expandArticleLibrary" })} onClick={() => setCollapsed(false)}>S</IconButton>
            </header>
            <footer className="mt-auto flex flex-col items-center gap-1 border-t border-border px-0.5 py-2">
                <IconButton label={intl.formatMessage({ id: "navigation.styleProfile" })} onClick={openStyleProfile}>
                    <UserIcon className="size-4" />
                </IconButton>
                <IconButton label={intl.formatMessage({ id: "navigation.settings" })} onClick={openSettings}>
                    <SettingsIcon className="size-4" />
                </IconButton>
                <span aria-label={saveLabel} className={`mt-1 inline-flex h-4 items-center text-xs ${saveTone}`} role="status" title={saveLabel}>
                    <span aria-hidden="true">&#9679;</span>
                </span>
            </footer>
        </> : <>
            <header className="flex min-h-18 items-center justify-between border-b border-border px-4">
                <span className="flex items-center gap-2 text-base font-semibold text-brand">
                    <span aria-hidden="true" className="text-lg leading-none">&#10022;</span>
                    Skladno
                </span>
                <div className="flex items-center gap-1">
                    <IconButton label={intl.formatMessage({ id: "navigation.newArticle" })} onClick={() => void createBlank()}>&#43;</IconButton>
                    <IconButton label={intl.formatMessage({ id: "navigation.collapseArticleLibrary" })} onClick={() => setCollapsed(true)}>&#8249;</IconButton>
                </div>
            </header>

            <div className="border-b border-border px-3 py-3">
                <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Field className="min-h-9 py-1.5 pl-8 pr-2" aria-label={intl.formatMessage({ id: "navigation.searchArticles" })} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={intl.formatMessage({ id: "navigation.searchArticles" })} />
                </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4" aria-label={intl.formatMessage({ id: "navigation.articleLibraryNav" })}>
                {articles.length > 0 && <>
                    <p className="px-2 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "navigation.recent" })}</p>
                    <div className="mt-2 space-y-1">
                        {visibleArticles.map((article) => {
                            const isSelected = article.id === selectedArticleId;
                            const detail = article.language ?? formatUpdatedAt(article.updatedAt, intl.formatMessage);

                            return <button key={article.id} onClick={() => selectArticle(article.id)} className={`w-full rounded-panel px-2 py-2.5 text-left transition-colors ${isSelected ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface-raised"}`} aria-current={isSelected ? "page" : undefined}>
                                <span className="flex gap-2">
                                    <ArticleIcon className="mt-0.5 size-4 shrink-0 text-muted" />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium leading-5">{article.title}</span>
                                        <span className="mt-0.5 block text-xs leading-4 text-muted">{detail}</span>
                                    </span>
                                </span>
                            </button>;
                        })}
                    </div>

                    {visibleArticles.length === 0 && <p className="px-2 py-5 text-sm text-muted">{intl.formatMessage({ id: "navigation.noArticlesMatch" })}</p>}
                </>}
            </nav>

            <footer className="border-t border-border px-2 py-2">
                <Button className="flex w-full items-center justify-start text-left" variant="quiet" onClick={openStyleProfile}>
                    <UserIcon className="size-4 shrink-0" />
                    <span className="ml-2">{intl.formatMessage({ id: "navigation.styleProfile" })}</span>
                </Button>
                <Button className="flex w-full items-center justify-start text-left" variant="quiet" onClick={openSettings}>
                    <SettingsIcon className="size-4 shrink-0" />
                    <span className="ml-2">{intl.formatMessage({ id: "navigation.settings" })}</span>
                </Button>
                <div className="flex items-center justify-between px-2 pb-1 pt-2 text-micro font-medium text-muted">
                    <span>{languageCode(language)} &middot; {intl.formatMessage({ id: "navigation.local" })}</span>
                    <span className={`inline-flex items-center gap-1 ${saveTone}`} role="status">
                        <span aria-hidden="true">&#9679;</span>
                        {saveLabel}
                    </span>
                </div>
            </footer>
        </>}
    </aside>;
}
