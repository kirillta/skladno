import { useEffect, useRef, useState } from "react";
import { articleLanguages, workflowStages, type Article, type UpdateArticleInput, type WorkflowStage } from "@skladno/shared";
import { Button, Field, Select } from "../../ui/primitives.js";
import { IntlProvider, useIntl } from "react-intl";
import { messages } from "../../i18n/messages.js";
import type { Notifications } from "../../notifications/notifications.js";

export function ArticleHeader(props: {
    article: Article;
    updateArticle: (articleId: string, input: UpdateArticleInput) => Promise<unknown>;
    save: () => Promise<unknown>;
    remove: (articleId: string) => Promise<void>;
    focusMode: boolean;
    setFocusMode: (value: boolean) => void;
    language: string;
    setLanguage: (language: string) => void;
    notifyError?: Notifications["notifyError"];
}) {
    return <IntlProvider locale="en" messages={messages}>
        <LocalizedArticleHeader {...props} />
    </IntlProvider>;
}

function LocalizedArticleHeader({ article, updateArticle, save, remove, focusMode, setFocusMode, language, setLanguage, notifyError }: {
    article: Article;
    updateArticle: (articleId: string, input: UpdateArticleInput) => Promise<unknown>;
    save: () => Promise<unknown>;
    remove: (articleId: string) => Promise<void>;
    focusMode: boolean;
    setFocusMode: (value: boolean) => void;
    language: string;
    setLanguage: (language: string) => void;
    notifyError?: Notifications["notifyError"];
}) {
    const intl = useIntl();
    const reportError = notifyError ?? (() => undefined);
    const [title, setTitle] = useState(article.title);
    const [editingTitle, setEditingTitle] = useState(false);
    const renameTimer = useRef<ReturnType<typeof setTimeout>>();
    const pendingTitle = useRef<string>();
    const workflowStageLabels: Record<WorkflowStage, "articleHeader.talkingPoints" | "articleHeader.narrative" | "articleHeader.authorEdit" | "articleHeader.flow" | "articleHeader.facts" | "articleHeader.style" | "articleHeader.translate" | "articleHeader.publish"> = {
        talking_points: "articleHeader.talkingPoints",
        narrative_draft: "articleHeader.narrative",
        author_editing: "articleHeader.authorEdit",
        flow_and_clarity: "articleHeader.flow",
        fact_checking: "articleHeader.facts",
        style_review: "articleHeader.style",
        translation: "articleHeader.translate",
        publication_preview: "articleHeader.publish",
    };

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


    function updateMetadata(input: UpdateArticleInput) {
        void updateArticle(article.id, input).catch((error) => reportError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) }));
    }

    return <header className="border-b border-border bg-surface-raised">
        <div className="flex min-h-16 items-center gap-3 px-5">
            <h1 className={editingTitle ? "min-w-0 flex-1 text-xl font-semibold tracking-tight" : "min-w-0 text-xl font-semibold tracking-tight"}>
                {editingTitle
                    ? <Field
                        autoFocus
                        aria-label={intl.formatMessage({ id: "articleHeader.title" })}
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
                    : <button className="max-w-md truncate text-left hover:text-brand focus:outline-none" type="button" aria-label={intl.formatMessage({ id: "articleHeader.rename" }, { articleTitle: article.title })} onClick={() => setEditingTitle(true)}>{article.title}</button>}
            </h1>
            <div className="ml-auto flex shrink-0 items-center gap-2">
                <Select className="min-h-9 !w-28 py-1.5 text-xs" aria-label={intl.formatMessage({ id: "articleHeader.sourceLanguage" })} value={article.language ?? "en"} onChange={(event) => updateMetadata({ language: event.target.value })}>
                    {articleLanguages.map((value) => <option key={value} value={value}>{intl.formatMessage({ id: languageMessageId(value) })}</option>)}
                </Select>
                <Select className="min-h-9 !w-28 py-1.5 text-xs" aria-label={intl.formatMessage({ id: "articleHeader.targetLanguage" })} value={language} onChange={(event) => setLanguage(event.target.value)}>
                    <option>{intl.formatMessage({ id: "languages.spanish" })}</option>
                    <option>{intl.formatMessage({ id: "languages.english" })}</option>
                    <option>{intl.formatMessage({ id: "languages.portuguese" })}</option>
                </Select>
                <Button variant="secondary" onClick={() => void save().catch(() => undefined)}>{intl.formatMessage({ id: "articleHeader.saveRevision" })}</Button>
                <Button variant="quiet" onClick={() => setFocusMode(!focusMode)}>{intl.formatMessage({ id: focusMode ? "articleHeader.leaveFocusMode" : "articleHeader.focusMode" })}</Button>
                <Button variant="danger" onClick={() => void remove(article.id).catch((error) => reportError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) }))}>{intl.formatMessage({ id: "articleHeader.deleteArticle" })}</Button>
            </div>
        </div>
        <div className="flex min-h-10 items-end gap-5 overflow-x-auto px-5 text-xs text-muted" aria-label={intl.formatMessage({ id: "articleHeader.workflow" })}>
            {workflowStages.map((stage) => <button key={stage} type="button" className={stage === article.workflowStage ? "border-b-2 border-brand py-3 font-semibold text-brand" : "py-3 hover:text-ink"} aria-pressed={stage === article.workflowStage} onClick={() => updateMetadata({ workflowStage: stage })}>{intl.formatMessage({ id: workflowStageLabels[stage] })}</button>)}
        </div>
    </header>;
}


function languageMessageId(language: string): "languages.english" | "languages.spanish" | "languages.portuguese" | "languages.russian" | "languages.french" | "languages.german" | "languages.italian" {
    return ({ en: "languages.english", es: "languages.spanish", pt: "languages.portuguese", ru: "languages.russian", fr: "languages.french", de: "languages.german", it: "languages.italian" } as const)[language as "en" | "es" | "pt" | "ru" | "fr" | "de" | "it"];
}
