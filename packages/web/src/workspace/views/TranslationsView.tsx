import type { Article, TranslationMetadata } from "@skladno/shared";
import { Banner, Button, EmptyState } from "../../ui/primitives.js";

export function TranslationsView({ article, translation, stale, create }: {
    article: Article;
    translation: TranslationMetadata | undefined;
    stale: boolean;
    create: () => Promise<void>
}) {
    return <div>
        <h2 className="font-semibold">Translations</h2>
        {article.sourceArticleId && <p>This translation is linked to its source Article and source Revision {article.sourceRevisionId?.slice(0, 8)}.</p>}
        {stale && <Banner className="mt-3" tone="warning">The source Article has changed since this translation proposal was made.</Banner>}
        {translation
            ? <Button className="mt-3" disabled={stale} onClick={() => void create()}>Create translation Article ({translation.targetLanguage})</Button>
            : <EmptyState title="No translation proposal">Ask the Editorial Assistant to translate this Article.</EmptyState>}
    </div>;
}
