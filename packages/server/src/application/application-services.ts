import type { ArticleService } from "./articles/article-service.js";
import type { AssistantService } from "./assistant/assistant-service.js";
import type { ApplicationSettingsService } from "./settings/application-settings-service.js";
import type { PublishingService } from "./publishing/publishing-service.js";
import type { StyleCorpusService } from "./editorial/style-corpus-service.js";
import type { ProposalSummaryService } from "./editorial/proposal-summary-service.js";
import type { FactCheckService } from "./editorial/fact-check-service.js";
import type { EditorialCapabilityCatalog } from "./assistant/editorial-capability-catalog.js";


export interface ApplicationServices {
    articles: ArticleService;
    assistant: AssistantService;
    settings: ApplicationSettingsService;
    publishing: PublishingService;
    styleCorpus: StyleCorpusService;
    proposalSummaries: ProposalSummaryService;
    factChecks: FactCheckService;
    capabilities?: EditorialCapabilityCatalog;
}
