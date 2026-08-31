import { useEffect, useRef, useState } from "react";
import { KEY_BINDING_COMMAND, type Article, type KeyBindingOverrides } from "@skladno/shared";
import type { DraftPresentationState as SaveState } from "../drafts/draft-lifecycle.js";
import { Button, Field, IconButton } from "../../ui/primitives.js";
import { ArticleIcon, ChevronRightIcon, SearchIcon, SettingsIcon, UserIcon } from "../../ui/icons.js";
import { useIntl } from "react-intl";
import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import { UpdateController } from "./UpdateController.js";


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


export function ArticleLibraryPanel({ articles, selectedArticleId, selectArticle, collapsed, setCollapsed, createBlank, openStyleProfile, openSettings, language, saveState, dispatcher, shortcutOverrides }: {
    articles: Article[];
    selectedArticleId: string | undefined;
    selectArticle: (articleId: string) => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    createBlank: () => Promise<unknown>;
    openStyleProfile: () => void;
    openSettings: () => void;
    language: string | undefined;
    saveState: SaveState;
    dispatcher?: KeyBindingDispatcher;
    shortcutOverrides?: KeyBindingOverrides;
}) {
    const intl = useIntl();
    const [query, setQuery] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    useEffect(() => dispatcher?.register(KEY_BINDING_COMMAND.SEARCH_ARTICLES, () => searchRef.current?.focus()), [dispatcher]);
    const normalizedQuery = query.toLowerCase();
    const matchesQuery = (article: Article) => article.title.toLowerCase().includes(normalizedQuery);
    const articleIds = new Set(articles.map((article) => article.id));
    const rootArticles = articles.filter((article) => !article.sourceArticleId || !articleIds.has(article.sourceArticleId));
    const children = (articleId: string) => articles.filter((article) => article.sourceArticleId === articleId);
    const visibleRoots = rootArticles.filter((article) => !query || matchesQuery(article) || children(article.id).some(matchesQuery));
    const selectedArticle = articles.find((article) => article.id === selectedArticleId);
    const expandedRootId = selectedArticle?.sourceArticleId ?? selectedArticle?.id;
    const saveLabels: Record<SaveState, string> = {
        saved: intl.formatMessage({ id: "navigation.saved" }),
        unsaved: intl.formatMessage({ id: "navigation.unsaved" }),
        saving: intl.formatMessage({ id: "navigation.savingDraft" }),
        "draft-saved": intl.formatMessage({ id: "navigation.draftSaved" }),
        error: intl.formatMessage({ id: "navigation.saveFailed" }),
        conflict: intl.formatMessage({ id: "navigation.saveConflict" }),
    };
    const saveLabel = saveLabels[saveState];
    const saveTone = saveState === "saved" || saveState === "draft-saved" ? "text-success" : saveState === "unsaved" || saveState === "saving" ? "text-warning" : "text-danger";
    const articleRow = ({ article, isChild = false, childCount = 0, isExpanded = false, isHidden = false }: { article: Article; isChild?: boolean; childCount?: number; isExpanded?: boolean; isHidden?: boolean }) => {
        const isSelected = article.id === selectedArticleId;
        const detail = [article.language, formatUpdatedAt(article.updatedAt, intl.formatMessage)].filter(Boolean).join(" · ");
        let tone = "text-ink/85 hover:bg-surface-raised";

        if (isChild)
            tone = "text-muted hover:bg-surface-raised";

        if (isSelected)
            tone = "bg-brand-soft text-ink";

        return <button key={article.id} onClick={() => selectArticle(article.id)} className={`${isChild ? "ml-4 w-[calc(100%-1rem)] border-l border-border py-1.5" : "w-full py-2.5"} rounded-panel px-2 text-left transition-colors ${tone}`} aria-current={isSelected ? "page" : undefined} aria-expanded={childCount > 0 ? isExpanded : undefined} tabIndex={isHidden ? -1 : undefined}>
            <span className="flex gap-2">
                {childCount > 0
                    ? <ChevronRightIcon className={`mt-1 size-3 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${isExpanded ? "rotate-90" : ""}`} />
                    : <ArticleIcon className="mt-0.5 size-4 shrink-0 text-muted" />}
                <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${isChild ? "text-xs leading-4" : "text-sm leading-5"}`} title={article.title}>{article.title}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-muted">{detail}</span>
                </span>
            </span>
        </button>;
    };

    return <aside data-workspace-panel="article-library" className={collapsed ? "flex h-full w-full flex-col border-r border-border bg-surface-supporting px-0.5 py-2" : "flex h-full w-full flex-col border-r border-border bg-surface-supporting"} aria-label={intl.formatMessage({ id: "navigation.articleLibrary" })}>
        {collapsed ? <>
            <header className="flex min-h-18 items-center justify-center">
                <IconButton className="text-base font-semibold text-brand" label={intl.formatMessage({ id: "navigation.expandArticleLibrary" })} onClick={() => setCollapsed(false)}>S</IconButton>
            </header>
            <footer className="mt-auto flex flex-col items-center gap-1 border-t border-border px-0.5 py-2">
                <IconButton label={intl.formatMessage({ id: "navigation.styleProfile" })} onClick={openStyleProfile}>
                    <UserIcon className="size-4" />
                </IconButton>
                <IconButton label={intl.formatMessage({ id: "navigation.settings" })} title={shortcutHint(intl.formatMessage({ id: "navigation.settings" }), KEY_BINDING_COMMAND.OPEN_SETTINGS, shortcutOverrides)} onClick={openSettings}>
                    <SettingsIcon className="size-4" />
                </IconButton>
                <UpdateController />
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
                    <IconButton label={intl.formatMessage({ id: "navigation.newArticle" })} title={shortcutHint(intl.formatMessage({ id: "navigation.newArticle" }), KEY_BINDING_COMMAND.NEW_ARTICLE, shortcutOverrides)} onClick={() => void createBlank()}>&#43;</IconButton>
                    <IconButton label={intl.formatMessage({ id: "navigation.collapseArticleLibrary" })} title={shortcutHint(intl.formatMessage({ id: "navigation.collapseArticleLibrary" }), KEY_BINDING_COMMAND.TOGGLE_ARTICLE_LIBRARY, shortcutOverrides)} onClick={() => setCollapsed(true)}>&#8249;</IconButton>
                </div>
            </header>

            <div className="border-b border-border px-3 py-3">
                <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Field ref={searchRef} className="min-h-9 py-1.5 pl-8 pr-2" aria-label={intl.formatMessage({ id: "navigation.searchArticles" })} title={shortcutHint(intl.formatMessage({ id: "navigation.searchArticles" }), KEY_BINDING_COMMAND.SEARCH_ARTICLES, shortcutOverrides)} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={intl.formatMessage({ id: "navigation.searchArticles" })} />
                </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" aria-label={intl.formatMessage({ id: "navigation.articleLibraryNav" })}>
                {articles.length > 0 && <>
                    <p className="px-2 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "navigation.recent" })}</p>
                    <div className="mt-2 space-y-1">
                        {visibleRoots.map((article) => {
                            const articleChildren = children(article.id).filter((child) => !query || matchesQuery(article) || matchesQuery(child));
                            const isExpanded = Boolean(query) || article.id === expandedRootId;

                            return <div key={article.id}>
                                {articleRow({ article, childCount: articleChildren.length, isExpanded })}
                                {articleChildren.length > 0 && <div className={`grid transition-[grid-template-rows,opacity] duration-150 motion-reduce:transition-none ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!isExpanded}>
                                    <div className="min-h-0 space-y-1 overflow-hidden">
                                        {articleChildren.map((child) => articleRow({ article: child, isChild: true, isHidden: !isExpanded }))}
                                    </div>
                                </div>}
                            </div>;
                        })}
                    </div>

                    {visibleRoots.length === 0 && <p className="px-2 py-5 text-sm text-muted">{intl.formatMessage({ id: "navigation.noArticlesMatch" })}</p>}
                </>}
            </nav>

            <footer className="border-t border-border px-2 py-2">
                <Button className="flex w-full items-center justify-start text-left" variant="quiet" onClick={openStyleProfile}>
                    <UserIcon className="size-4 shrink-0" />
                    <span className="ml-2">{intl.formatMessage({ id: "navigation.styleProfile" })}</span>
                </Button>
                <Button className="flex w-full items-center justify-start text-left" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "navigation.settings" }), KEY_BINDING_COMMAND.OPEN_SETTINGS, shortcutOverrides)} onClick={openSettings}>
                    <SettingsIcon className="size-4 shrink-0" />
                    <span className="ml-2">{intl.formatMessage({ id: "navigation.settings" })}</span>
                </Button>
                <UpdateController expanded />
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
