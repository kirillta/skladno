import type { ArticleService } from "./articles/article-service.js";
import type { AssistantService } from "./assistant/assistant-service.js";
import type { ApplicationSettingsService } from "./settings/application-settings-service.js";
import type { PublishingService } from "./publishing/publishing-service.js";
import type { StyleCorpusService } from "./editorial/style-corpus-service.js";


export interface ApplicationServices {
    articles: ArticleService;
    assistant: AssistantService;
    settings: ApplicationSettingsService;
    publishing: PublishingService;
    styleCorpus: StyleCorpusService;
}
