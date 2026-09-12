import type { ArticleService } from "./services/articles/article-service.js";
import type { AssistantService } from "./services/assistant/assistant-service.js";
import type { ApplicationSettingsService } from "./services/settings/application-settings-service.js";
import type { PublishingService } from "./services/publishing/publishing-service.js";
import type { StyleCorpusService } from "./services/editorial/style-corpus-service.js";
import type { ProposalSummaryService } from "./services/editorial/proposal-summary-service.js";
import type { FactCheckService } from "./services/editorial/fact-check-service.js";
import type { EditorialCapabilityCatalog } from "./services/assistant/editorial-capability-catalog.js";
import type { AssistantSkillCatalog } from "./services/assistant/assistant-skill-catalog.js";


export interface ApplicationServices {
    articles: ArticleService;
    assistant: AssistantService;
    settings: ApplicationSettingsService;
    publishing: PublishingService;
    styleCorpus: StyleCorpusService;
    proposalSummaries: ProposalSummaryService;
    factChecks: FactCheckService;
    capabilities?: EditorialCapabilityCatalog;
    skills: AssistantSkillCatalog;
}
