import type { ApplicationServices } from "./application-services.js";
import { ArticleService } from "./articles/article-service.js";
import { AssistantService } from "./assistant/assistant-service.js";
import type { AvailableModelsProvider } from "./ports/available-models-provider.js";
import type { AssistantArtifactStore } from "./ports/assistant-artifact-store.js";
import type { AssistantStore } from "./ports/assistant-store.js";
import type { EditorialEngineResolver } from "./ports/editorial-engine-resolver.js";
import { PublishingService } from "./publishing/publishing-service.js";
import { StyleCorpusService } from "./editorial/style-corpus-service.js";
import { ApplicationSettingsService } from "./settings/application-settings-service.js";
import { ProposalSummaryService } from "./editorial/proposal-summary-service.js";
import { FactCheckService } from "./editorial/fact-check-service.js";
import type { ArticleStore } from "./ports/article-store.js";
import type { SettingsStore } from "./ports/settings-store.js";
import type { StyleCorpusStore } from "./ports/style-corpus-store.js";
import type { SystemDateTimeFormatProvider } from "./ports/system-date-time-format-provider.js";


export function createApplicationServices(articles: ArticleStore, settings: SettingsStore, styleCorpus: StyleCorpusStore, assistant: AssistantStore, artifacts: AssistantArtifactStore, engines: EditorialEngineResolver, dateTimeFormat: SystemDateTimeFormatProvider, models: AvailableModelsProvider, createConnectionId: () => string, factChecks: ConstructorParameters<typeof FactCheckService>[0] = { list: () => [], resolve: () => undefined }): ApplicationServices {
    return {
        articles: new ArticleService(articles, assistant),
        assistant: new AssistantService(articles, assistant, styleCorpus, artifacts, engines),
        settings: new ApplicationSettingsService(settings, dateTimeFormat, models, createConnectionId),
        publishing: new PublishingService(settings),
        styleCorpus: new StyleCorpusService(styleCorpus),
        proposalSummaries: new ProposalSummaryService(engines, artifacts),
        factChecks: new FactCheckService(factChecks),
    };
}
