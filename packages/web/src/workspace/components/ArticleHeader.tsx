import { useEffect, useRef, useState } from "react";
import { articleLanguages, workflowStages, type Article, type KeyBindingOverrides, type UpdateArticleInput, type WorkflowStage } from "@skladno/shared";
import { Button, Field, Select } from "../../ui/primitives.js";
import { IntlProvider, useIntl } from "react-intl";
import { messages } from "../../i18n/messages.js";
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
    targetLanguage: string;
    setTargetLanguage: (language: string) => void;
    notifyError?: Notifications["notifyError"];
    shortcutOverrides?: KeyBindingOverrides;
}) {
    return <IntlProvider locale="en" messages={messages}>
        <LocalizedArticleHeader {...props} />
    </IntlProvider>;
}


function LocalizedArticleHeader({ article, updateArticle, save, remove, focusMode, setFocusMode, targetLanguage, setTargetLanguage, notifyError, shortcutOverrides = {} }: Parameters<typeof ArticleHeader>[0]) {
    const intl = useIntl();
    const reportError = notifyError ?? (() => undefined);
    const [title, setTitle] = useState(article.title);
    const [editingTitle, setEditingTitle] = useState(false);
    const renameTimer = useRef<ReturnType<typeof setTimeout>>();
    const pendingTitle = useRef<string>();

    useEffect(() => {
        setTitle(article.title);
        setEditingTitle(false);
        pendingTitle.current = undefined;
        clearTimeout(renameTimer.current);
    }, [article.id, article.title]);

    useEffect(() => () => clearTimeout(renameTimer.current), []);

    function updateMetadata(input: UpdateArticleInput) {
        void updateArticle(article.id, input).catch((error) => reportError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) }));
    }

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

    return <header className="border-b border-border bg-surface-raised">
        <div className="flex min-h-16 items-center gap-3 px-5">
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
                    : <button className="max-w-md truncate text-left hover:text-brand focus:outline-none" type="button" aria-label={intl.formatMessage({ id: "articleHeader.rename" }, { articleTitle: article.title })} onClick={() => setEditingTitle(true)}>{article.title}</button>}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" title={shortcutHint(intl.formatMessage({ id: "articleHeader.saveRevision" }), KEY_BINDING_COMMAND.SAVE_REVISION, shortcutOverrides)} onClick={() => void save().catch(() => undefined)}>{intl.formatMessage({ id: "articleHeader.saveRevision" })}</Button>
                <Button variant="quiet" title={shortcutHint(intl.formatMessage({ id: focusMode ? "articleHeader.leaveFocusMode" : "articleHeader.focusMode" }), KEY_BINDING_COMMAND.TOGGLE_FOCUS_MODE, shortcutOverrides)} onClick={() => setFocusMode(!focusMode)}>{intl.formatMessage({ id: focusMode ? "articleHeader.leaveFocusMode" : "articleHeader.focusMode" })}</Button>
                <Button variant="danger" onClick={() => void remove(article.id).catch((error) => reportError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) }))}>{intl.formatMessage({ id: "articleHeader.deleteArticle" })}</Button>
            </div>
        </div>
        <div className="flex min-h-12 items-center gap-2 overflow-x-auto border-t border-border px-5 py-1.5 text-xs" aria-label={intl.formatMessage({ id: "articleHeader.metadata" })}>
            <Select className="min-w-32 !w-36" aria-label={intl.formatMessage({ id: "articleHeader.workflow" })} value={article.workflowStage} onChange={(event) => updateMetadata({ workflowStage: event.target.value as WorkflowStage })}>
                {workflowStages.map((stage) => <option key={stage} value={stage}>{intl.formatMessage({ id: workflowStageMessageId(stage) })}</option>)}
            </Select>
            <Select className="min-w-28 !w-32" aria-label={intl.formatMessage({ id: "articleHeader.sourceLanguage" })} value={article.language ?? "en"} onChange={(event) => updateMetadata({ language: event.target.value })}>
                {articleLanguages.map((language) => <option key={language} value={language}>{intl.formatMessage({ id: languageMessageId(language) })}</option>)}
            </Select>
            <Select className="min-w-28 !w-32" aria-label={intl.formatMessage({ id: "articleHeader.targetLanguage" })} value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                {articleLanguages.map((language) => <option key={language} value={language}>{intl.formatMessage({ id: languageMessageId(language) })}</option>)}
            </Select>
        </div>
    </header>;
}


function workflowStageMessageId(stage: WorkflowStage): "articleHeader.talkingPoints" | "articleHeader.narrative" | "articleHeader.authorEdit" | "articleHeader.flow" | "articleHeader.facts" | "articleHeader.style" | "articleHeader.translate" | "articleHeader.publish" {
    return ({ talking_points: "articleHeader.talkingPoints", narrative_draft: "articleHeader.narrative", author_editing: "articleHeader.authorEdit", flow_and_clarity: "articleHeader.flow", fact_checking: "articleHeader.facts", style_review: "articleHeader.style", translation: "articleHeader.translate", publication_preview: "articleHeader.publish" } as const)[stage];
}


function languageMessageId(language: string): "languages.english" | "languages.spanish" | "languages.portuguese" | "languages.russian" | "languages.french" | "languages.german" | "languages.italian" {
    return ({ en: "languages.english", es: "languages.spanish", pt: "languages.portuguese", ru: "languages.russian", fr: "languages.french", de: "languages.german", it: "languages.italian" } as const)[language as "en" | "es" | "pt" | "ru" | "fr" | "de" | "it"];
}
