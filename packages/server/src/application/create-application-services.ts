import type { ApplicationServices } from "./application-services.js";
import { ArticleService } from "./articles/article-service.js";
import { AssistantService } from "./assistant/assistant-service.js";
import type { AvailableModelsProvider } from "./ports/available-models-provider.js";
import type { BackupManager } from "./ports/backup-manager.js";
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
import type { ManagedCredentials } from "./ports/managed-credentials.js";
import { EditorialCapabilityCatalog } from "./assistant/editorial-capability-catalog.js";
import type { EditorialService } from "./editorial/editorial-service.js";
import { AssistantSkillCatalog, builtInSkillSource } from "./assistant/assistant-skill-catalog.js";


export function createApplicationServices(
    articles: ArticleStore,
    settings: SettingsStore,
    styleCorpus: StyleCorpusStore,
    assistant: AssistantStore,
    artifacts: AssistantArtifactStore,
    engines: EditorialEngineResolver,
    dateTimeFormat: SystemDateTimeFormatProvider,
    models: AvailableModelsProvider,
    createConnectionId: () => string,
    factChecks: ConstructorParameters<typeof FactCheckService>[0] & { save(artifactId: string, articleId: string, revisionId: string): void } = { list: () => [], resolve: () => undefined, save: () => undefined },
    backups?: BackupManager,
    credentials?: ManagedCredentials,
    editorial?: EditorialService,
): ApplicationServices {
    const articleService = new ArticleService(articles, assistant);
    const publishing = new PublishingService(settings);
    const factCheckService = new FactCheckService(factChecks);
    const styleCorpusService = new StyleCorpusService(styleCorpus, engines, articles);
    const capabilities = editorial ? new EditorialCapabilityCatalog(articleService, artifacts, publishing, editorial, styleCorpusService, factChecks) : undefined;
    return {
        articles: articleService,
        assistant: new AssistantService(articles, assistant, styleCorpus, artifacts, engines, factChecks, capabilities),
        settings: new ApplicationSettingsService(settings, dateTimeFormat, models, createConnectionId, backups, credentials),
        publishing,
        styleCorpus: styleCorpusService,
        proposalSummaries: new ProposalSummaryService(engines, artifacts),
        factChecks: factCheckService,
        skills: new AssistantSkillCatalog([builtInSkillSource]),
        ...(capabilities ? { capabilities } : {}),
    };
}
