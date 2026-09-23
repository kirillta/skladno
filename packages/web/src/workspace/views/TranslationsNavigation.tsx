import { type Article } from "@skladno/shared";
import { Banner, Button, Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { getProviderLanguageName } from "../state/editorial-language.js";
import type { Translation } from "./translations-view-types.js";


interface TranslationsNavigationProps {
    article: Article;
    sourceArticle?: Article;
    linkedTranslations: readonly Article[];
    translations: readonly Translation[];
    translation?: Translation;
    stale: boolean;
    openArticle?: (articleId: string) => void;
    selectTargetLanguage?: (language: string) => void;
}


export function TranslationsNavigation({ article, sourceArticle, linkedTranslations, translations, translation, stale, openArticle, selectTargetLanguage }: TranslationsNavigationProps) {
    const intl = useIntl();

    return <>
        {translations.length > 1 && <TabList className="mt-4">
            {translations.map((item) => <Tab key={item.metadata.targetLanguage} selected={item.metadata.targetLanguage === translation?.metadata.targetLanguage} onClick={() => selectTargetLanguage?.(item.metadata.targetLanguage)}>{item.metadata.targetLanguage}</Tab>)}
        </TabList>}
        {(linkedTranslations.length > 0 && openArticle || sourceArticle && openArticle) && <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
            {linkedTranslations.length > 0 && openArticle && <nav className="flex items-center gap-2" aria-label={intl.formatMessage({ id: "views.existingTranslations" })}>
                <span className="text-xs font-semibold text-muted">{intl.formatMessage({ id: "views.existingTranslations" })}</span>
                {linkedTranslations.map((linked) => <Button key={linked.id} variant="quiet" onClick={() => openArticle(linked.id)}>{intl.formatMessage({ id: "views.openTranslation" }, { language: getProviderLanguageName(linked.language ?? ""), title: linked.title })}</Button>)}
            </nav>}
            {sourceArticle && openArticle && <p className="text-xs text-muted">
                {intl.formatMessage({ id: "views.sourceLinkedPrefix" })} <button type="button" className="font-semibold text-brand underline underline-offset-2" onClick={() => openArticle(sourceArticle.id)}>{sourceArticle.title}</button>{article.sourceRevisionNumber ? ` ${intl.formatMessage({ id: "views.sourceLinkedRevision" }, { revisionNumber: article.sourceRevisionNumber })}` : null}
            </p>}
        </div>}
        {stale && <Banner className="mt-3" tone="warning">{intl.formatMessage({ id: "views.translationStale" })}</Banner>}
    </>;
}
