import type { ArticleService } from "./articles/article-service.js";
import type { PublishingService } from "./publishing/publishing-service.js";
import type { StyleCorpusService } from "./editorial/style-corpus-service.js";


export interface ApplicationServices {
    articles: ArticleService;
    publishing: PublishingService;
    styleCorpus: StyleCorpusService;
}
