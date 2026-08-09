import type { ApplicationServices } from "./application-services.js";
import { ArticleService } from "./articles/article-service.js";
import { PublishingService } from "./publishing/publishing-service.js";
import { StyleCorpusService } from "./editorial/style-corpus-service.js";
import type { ArticleStore } from "./ports/article-store.js";
import type { SettingsStore } from "./ports/settings-store.js";
import type { StyleCorpusStore } from "./ports/style-corpus-store.js";


export function createApplicationServices(stores: ArticleStore & SettingsStore & StyleCorpusStore): ApplicationServices {
    return {
        articles: new ArticleService(stores),
        publishing: new PublishingService(stores),
        styleCorpus: new StyleCorpusService(stores),
    };
}
