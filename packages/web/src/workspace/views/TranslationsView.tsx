import type { Article, TranslationMetadata } from "@skladno/shared";
import { Banner, Button, EmptyState } from "../../ui/primitives.js";
import { useIntl } from "react-intl";


export function TranslationsView({ article, translation, stale, create }: {
    article: Article;
    translation: TranslationMetadata | undefined;
    stale: boolean;
    create: () => Promise<void>
}) {
    const intl = useIntl();
    return <div>
        <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.translations" })}</h2>
        {article.sourceArticleId && <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "views.sourceLinked" }, { revisionId: article.sourceRevisionId?.slice(0, 8) })}</p>}
        {stale && <Banner className="mt-3" tone="warning">{intl.formatMessage({ id: "views.translationStale" })}</Banner>}
        {translation
            ? <Button className="mt-3" disabled={stale} onClick={() => void create()}>{intl.formatMessage({ id: "views.createTranslation" }, { language: translation.targetLanguage })}</Button>
            : <EmptyState title={intl.formatMessage({ id: "views.translationEmptyTitle" })}>{intl.formatMessage({ id: "views.translationEmpty" })}</EmptyState>}
    </div>;
}
