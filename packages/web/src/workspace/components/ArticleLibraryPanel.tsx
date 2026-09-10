import { useEffect, useRef, useState } from "react";
import { KEY_BINDING_COMMAND, type Article, type KeyBindingOverrides } from "@skladno/shared";
import { Button, Dialog, Field, IconButton } from "../../ui/primitives.js";
import { ArticleIcon, ChevronRightIcon, SearchIcon, SettingsIcon, UserIcon } from "../../ui/icons.js";
import { useIntl } from "react-intl";
import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import { UpdateController } from "./UpdateController.js";
import type { Notifications } from "../../notifications/notifications.js";


function formatUpdatedAt(updatedAt: string, formatMessage: ReturnType<typeof useIntl>["formatMessage"]): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000));
    if (minutes < 1)
        return formatMessage({ id: "navigation.updatedJustNow" });

    if (minutes < 60)
        return formatMessage({ id: "navigation.updatedMinutes" }, { count: minutes });

    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return formatMessage({ id: "navigation.updatedHours" }, { count: hours });

    return formatMessage({ id: "navigation.updatedDays" }, { count: Math.floor(hours / 24) });
}


function languageCode(language: string | undefined): string {
    const codes: Record<string, string> = { English: "EN", Spanish: "ES", Portuguese: "PT" };
    return language ? codes[language] ?? language.slice(0, 2).toUpperCase() : "EN";
}


export function ArticleLibraryPanel({ articles, selectedArticleId, selectArticle, collapsed, setCollapsed, createBlank, openStyleProfile, openSettings, language, dispatcher, shortcutOverrides, remove, setArchived, setPinned, reorderPinned, notifyError }: {
    articles: Article[]; selectedArticleId: string | undefined; selectArticle: (articleId: string) => void; collapsed: boolean; setCollapsed: (value: boolean) => void; createBlank: () => Promise<unknown>; openStyleProfile: () => void; openSettings: () => void; language: string | undefined; dispatcher?: KeyBindingDispatcher; shortcutOverrides?: KeyBindingOverrides;
    remove?: (articleId: string) => Promise<void>; setArchived?: (articleId: string, archived: boolean) => Promise<void>; setPinned?: (articleId: string, pinned: boolean) => Promise<void>; reorderPinned?: (articleIds: string[]) => Promise<void>; notifyError?: Notifications["notifyError"];
}) {
    const intl = useIntl();
    const reportError = notifyError ?? (() => undefined);
    const [query, setQuery] = useState("");
    const [archivedOpen, setArchivedOpen] = useState(false);
    const [menuArticleId, setMenuArticleId] = useState<string>();
    const [deleteTarget, setDeleteTarget] = useState<Article>();
    const [draggedArticleId, setDraggedArticleId] = useState<string>();
    const searchRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
    useEffect(() => dispatcher?.register(KEY_BINDING_COMMAND.SEARCH_ARTICLES, () => searchRef.current?.focus()), [dispatcher]);
    useEffect(() => {
        if (!menuArticleId)
            return;

        menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
        const dismiss = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setMenuArticleId(undefined);
                requestAnimationFrame(() => triggerRefs.current.get(menuArticleId)?.focus());
            }
        };

        window.addEventListener("mousedown", dismiss);
        return () => window.removeEventListener("mousedown", dismiss);
    }, [menuArticleId]);
    const normalizedQuery = query.toLowerCase();
    const matches = (article: Article) => article.title.toLowerCase().includes(normalizedQuery);
    const articleIds = new Set(articles.map((article) => article.id));
    const roots = articles.filter((article) => !article.sourceArticleId || !articleIds.has(article.sourceArticleId));
    const children = (id: string) => articles.filter((article) => article.sourceArticleId === id);
    const selected = articles.find((article) => article.id === selectedArticleId);
    const expandedRootId = selected?.sourceArticleId ?? selected?.id;
    const activeRoots = roots.filter((article) => !article.archived);
    const pinnedRoots = activeRoots.filter((article) => article.pinOrder !== undefined).sort((a, b) => a.pinOrder! - b.pinOrder! || a.id.localeCompare(b.id));
    const recentRoots = activeRoots.filter((article) => article.pinOrder === undefined);
    const archivedRoots = roots.filter((article) => article.archived);


    function closeMenu() {
        const id = menuArticleId;
        setMenuArticleId(undefined);
        if (id)
            requestAnimationFrame(() => triggerRefs.current.get(id)?.focus());
    }


    function run(action: () => Promise<void>) {
        void action().catch((error) => reportError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.updateArticleFailed" }) }));
        closeMenu();
    }


    function movePinned(article: Article, direction: -1 | 1) {
        const index = pinnedRoots.findIndex((item) => item.id === article.id);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= pinnedRoots.length || !reorderPinned)
            return;

        const next = [...pinnedRoots];
        [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
        run(() => reorderPinned(next.map((item) => item.id)));
    }


    function menuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
        }
    }


    const row = ({ article, child = false, childCount = 0, expanded = false, hidden = false }: { article: Article; child?: boolean; childCount?: number; expanded?: boolean; hidden?: boolean }) => {
        const selectedRow = article.id === selectedArticleId;
        const tone = selectedRow ? "bg-brand-soft text-ink" : child ? "text-muted hover:bg-surface-raised" : "text-ink/85 hover:bg-surface-raised";
        const canReorder = !child && article.pinOrder !== undefined && !article.archived;
        return <div key={article.id} draggable={canReorder} onDragStart={() => setDraggedArticleId(article.id)} onDragOver={(event) => canReorder && event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            if (!draggedArticleId || draggedArticleId === article.id || !reorderPinned)
                return;

            const dragged = pinnedRoots.find((item) => item.id === draggedArticleId);
            if (!dragged)
                return;

            const next = pinnedRoots.filter((item) => item.id !== draggedArticleId);
            next.splice(next.findIndex((item) => item.id === article.id), 0, dragged);
            run(() => reorderPinned(next.map((item) => item.id)));
        }}>
            <button ref={(element) => {
                if (element)
                    triggerRefs.current.set(article.id, element);
            }} type="button" onClick={() => selectArticle(article.id)} onContextMenu={(event) => {
                event.preventDefault();
                setMenuArticleId(article.id);
            }} onKeyDown={(event) => {
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    event.preventDefault();
                    setMenuArticleId(article.id);
                }
            }} className={`${child ? "ml-4 w-[calc(100%-1rem)] border-l border-border py-1.5" : "w-full py-2.5"} rounded-panel px-2 text-left transition-colors ${tone}`} aria-current={selectedRow ? "page" : undefined} aria-expanded={childCount > 0 ? expanded : undefined} tabIndex={hidden ? -1 : undefined}>
                <span className="flex gap-2">{childCount > 0 ? <ChevronRightIcon className={`mt-1 size-3 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`} /> : <ArticleIcon className="mt-0.5 size-4 shrink-0 text-muted" />}<span className="min-w-0 flex-1"><span className={`block truncate font-medium ${child ? "text-xs leading-4" : "text-sm leading-5"}`} title={article.title}>{article.title}</span><span className="mt-0.5 block text-xs leading-4 text-muted">{[article.language, formatUpdatedAt(article.updatedAt, intl.formatMessage)].filter(Boolean).join(" · ")}</span></span></span>
            </button>
            {menuArticleId === article.id && <div ref={menuRef} className="relative z-20" role="menu" aria-label={article.title} onKeyDown={menuKeyDown}><div className="absolute left-2 top-0 w-36 rounded-control border border-border bg-surface-raised p-1 shadow-raised">
                {!article.sourceArticleId && !article.archived && <button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs hover:bg-brand-soft focus:outline-none" type="button" role="menuitem" onClick={() => run(() => setPinned?.(article.id, article.pinOrder === undefined) ?? Promise.resolve())}>{intl.formatMessage({ id: article.pinOrder === undefined ? "navigation.pin" : "navigation.unpin" })}</button>}
                {!article.sourceArticleId && <button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs hover:bg-brand-soft focus:outline-none" type="button" role="menuitem" onClick={() => run(() => setArchived?.(article.id, !article.archived) ?? Promise.resolve())}>{intl.formatMessage({ id: article.archived ? "navigation.unarchive" : "navigation.archive" })}</button>}
                {canReorder && <><button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs hover:bg-brand-soft focus:outline-none disabled:opacity-50" type="button" role="menuitem" disabled={pinnedRoots[0]?.id === article.id} onClick={() => movePinned(article, -1)}>{intl.formatMessage({ id: "navigation.movePinnedUp" })}</button><button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs hover:bg-brand-soft focus:outline-none disabled:opacity-50" type="button" role="menuitem" disabled={pinnedRoots.at(-1)?.id === article.id} onClick={() => movePinned(article, 1)}>{intl.formatMessage({ id: "navigation.movePinnedDown" })}</button></>}
                <button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs text-danger hover:bg-danger-soft focus:outline-none" type="button" role="menuitem" onClick={() => {
                    setDeleteTarget(article);
                    closeMenu();
                }}>{intl.formatMessage({ id: "navigation.delete" })}</button>
            </div></div>}
        </div>;
    };

    const renderRoots = (items: Article[]) => items.filter((article) => !query || matches(article) || children(article.id).some(matches)).map((article) => {
        const nested = children(article.id).filter((child) => !query || matches(article) || matches(child));
        const expanded = Boolean(query) || article.id === expandedRootId;
        return <div key={article.id}>{row({ article, childCount: nested.length, expanded })}{nested.length > 0 && <div className={`grid transition-[grid-template-rows,opacity] duration-150 motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!expanded}><div className="min-h-0 space-y-1 overflow-hidden">{nested.map((child) => row({ article: child, child: true, hidden: !expanded }))}</div></div>}</div>;
    });

    const archivedContent = renderRoots(archivedRoots);
    const groupCount = deleteTarget ? (deleteTarget.sourceArticleId ? 1 : children(deleteTarget.id).length + 1) : 1;
    return <aside data-workspace-panel="article-library" className={collapsed ? "flex h-full w-full flex-col border-r border-border bg-surface-supporting px-0.5 py-2" : "flex h-full w-full flex-col border-r border-border bg-surface-supporting"} aria-label={intl.formatMessage({ id: "navigation.articleLibrary" })}>
        {collapsed ? <><header className="flex min-h-18 items-center justify-center"><IconButton className="text-base font-semibold text-brand" label={intl.formatMessage({ id: "navigation.expandArticleLibrary" })} onClick={() => setCollapsed(false)}>S</IconButton></header><footer className="mt-auto flex flex-col items-center gap-1 border-t border-border px-0.5 py-2"><IconButton label={intl.formatMessage({ id: "navigation.styleProfile" })} onClick={openStyleProfile}><UserIcon className="size-4" /></IconButton><IconButton label={intl.formatMessage({ id: "navigation.settings" })} title={shortcutHint(intl.formatMessage({ id: "navigation.settings" }), KEY_BINDING_COMMAND.OPEN_SETTINGS, shortcutOverrides)} onClick={openSettings}><SettingsIcon className="size-4" /></IconButton><UpdateController /></footer></> : <>
            <header className="flex min-h-18 items-center justify-between border-b border-border px-4"><span className="flex items-center gap-2 text-base font-semibold text-brand"><span aria-hidden="true" className="text-lg leading-none">✢</span>Skladno</span><div className="flex items-center gap-1"><IconButton label={intl.formatMessage({ id: "navigation.newArticle" })} title={shortcutHint(intl.formatMessage({ id: "navigation.newArticle" }), KEY_BINDING_COMMAND.NEW_ARTICLE, shortcutOverrides)} onClick={() => void createBlank()}>+</IconButton><IconButton label={intl.formatMessage({ id: "navigation.collapseArticleLibrary" })} title={shortcutHint(intl.formatMessage({ id: "navigation.collapseArticleLibrary" }), KEY_BINDING_COMMAND.TOGGLE_ARTICLE_LIBRARY, shortcutOverrides)} onClick={() => setCollapsed(true)}>‹</IconButton></div></header>
            <div className="border-b border-border px-3 py-3"><div className="relative"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Field ref={searchRef} className="min-h-9 py-1.5 pl-8 pr-2" aria-label={intl.formatMessage({ id: "navigation.searchArticles" })} title={shortcutHint(intl.formatMessage({ id: "navigation.searchArticles" }), KEY_BINDING_COMMAND.SEARCH_ARTICLES, shortcutOverrides)} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={intl.formatMessage({ id: "navigation.searchArticles" })} /></div></div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" aria-label={intl.formatMessage({ id: "navigation.articleLibraryNav" })}>
                {pinnedRoots.length > 0 && <><p className="px-2 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "navigation.pinned" })}</p><div className="mt-2 space-y-1">{renderRoots(pinnedRoots)}</div></>}
                {recentRoots.length > 0 && <><p className="mt-4 px-2 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "navigation.recent" })}</p><div className="mt-2 space-y-1">{renderRoots(recentRoots)}</div></>}
                {archivedRoots.length > 0 && <section className="mt-4"><button className="flex w-full items-center gap-2 px-2 text-micro font-semibold uppercase tracking-overline text-muted focus:outline-none" type="button" aria-expanded={archivedOpen || Boolean(query)} onClick={() => setArchivedOpen((open) => !open)}><ChevronRightIcon className={`size-3 transition-transform ${archivedOpen || query ? "rotate-90" : ""}`} />{intl.formatMessage({ id: "navigation.archived" }, { count: archivedRoots.length })}</button>{(archivedOpen || Boolean(query)) && <div className="mt-2 space-y-1">{archivedContent}</div>}</section>}
                {articles.length > 0 && pinnedRoots.length + recentRoots.length === 0 && archivedContent.length === 0 && <p className="px-2 py-5 text-sm text-muted">{intl.formatMessage({ id: "navigation.noArticlesMatch" })}</p>}
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
                <div className="relative flex items-center justify-between px-2 pb-1 pt-2 pr-11 text-micro font-medium text-muted">
                    <span>{languageCode(language)} · {intl.formatMessage({ id: "navigation.local" })}</span>
                    <UpdateController className="absolute right-2 top-1/2 -translate-y-1/2" />
                </div>
            </footer>
        </>}
        {deleteTarget && <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="delete-library-article-title" onCancel={(event) => {
            event.preventDefault();
            setDeleteTarget(undefined);
        }}>
            <h2 id="delete-library-article-title" className="text-lg font-semibold">{intl.formatMessage({ id: "articleHeader.deleteConfirmationTitle" })}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "articleHeader.deleteGroupConfirmationDescription" }, { articleTitle: deleteTarget.title, count: groupCount })}</p>
            <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" autoFocus onClick={() => setDeleteTarget(undefined)}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
                <Button variant="danger"
                    onClick={() => run(async () => {
                        await (remove?.(deleteTarget.id) ?? Promise.resolve());
                        setDeleteTarget(undefined);
                    })}
                >
                    {intl.formatMessage({ id: "articleHeader.confirmDeleteArticle" })}
                </Button>
            </div>
        </Dialog>}
    </aside>;
}
