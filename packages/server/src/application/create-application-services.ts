import type { ApplicationServices } from "./application-services.js";
import { ArticleService } from "./services/articles/article-service.js";
import { AssistantService } from "./services/assistant/assistant-service.js";
import type { AvailableModelsProvider } from "./services/settings/available-models-provider.js";
import type { BackupManager } from "./services/settings/backup-manager.js";
import type { AssistantArtifactStore } from "./services/assistant/assistant-artifact-store.js";
import type { AssistantStore } from "./services/assistant/assistant-store.js";
import type { EditorialEngineResolver } from "./services/editorial/editorial-engine-resolver.js";
import { PublishingService } from "./services/publishing/publishing-service.js";
import { StyleCorpusService } from "./services/editorial/style-corpus-service.js";
import { ApplicationSettingsService } from "./services/settings/application-settings-service.js";
import { ProposalSummaryService } from "./services/editorial/proposal-summary-service.js";
import { FactCheckService } from "./services/editorial/fact-check-service.js";
import type { ArticleStore } from "./services/articles/article-store.js";
import type { SettingsStore } from "./services/settings/settings-store.js";
import type { StyleCorpusStore } from "./services/editorial/style-corpus-store.js";
import type { SystemDateTimeFormatProvider } from "./services/settings/system-date-time-format-provider.js";
import type { CredentialStore } from "./services/settings/credential-store.js";
import { EditorialCapabilityCatalog } from "./services/assistant/editorial-capability-catalog.js";
import type { EditorialService } from "./services/editorial/editorial-service.js";
import { AssistantSkillCatalog, builtInSkillSource } from "./services/assistant/assistant-skill-catalog.js";
import type { TelemetryObserver } from "./telemetry/telemetry-observer.js";


export interface CreateApplicationServicesOptions {
    articles: ArticleStore;
    settings: SettingsStore;
    styleCorpus: StyleCorpusStore;
    assistant: AssistantStore;
    artifacts: AssistantArtifactStore;
    engines: EditorialEngineResolver;
    dateTimeFormat: SystemDateTimeFormatProvider;
    models: AvailableModelsProvider;
    createConnectionId: () => string;
    factChecks?: ConstructorParameters<typeof FactCheckService>[0] & { save(artifactId: string, articleId: string, revisionId: string): void };
    backups?: BackupManager;
    credentialStore?: CredentialStore;
    editorial?: EditorialService;
    telemetry?: TelemetryObserver;
}


export function createApplicationServices({
    articles,
    settings,
    styleCorpus,
    assistant,
    artifacts,
    engines,
    dateTimeFormat,
    models,
    createConnectionId,
    factChecks = { list: () => [], resolve: () => undefined, save: () => undefined },
    backups,
    credentialStore,
    editorial,
    telemetry,
}: CreateApplicationServicesOptions): ApplicationServices {
    const articleService = new ArticleService(articles, assistant, telemetry);
    const publishing = new PublishingService(settings);
    const factCheckService = new FactCheckService(factChecks);
    const styleCorpusService = new StyleCorpusService(styleCorpus, engines, articles);
    const capabilities = editorial
        ? new EditorialCapabilityCatalog(articleService, artifacts, publishing, editorial, styleCorpusService, factChecks)
        : undefined;
    const skills = new AssistantSkillCatalog([builtInSkillSource]);

    return {
        articles: articleService,
        assistant: new AssistantService(articles, assistant, styleCorpus, artifacts, engines, factChecks, capabilities, telemetry, skills),
        settings: new ApplicationSettingsService(settings, dateTimeFormat, models, createConnectionId, backups, credentialStore),
        publishing,
        styleCorpus: styleCorpusService,
        proposalSummaries: new ProposalSummaryService(engines, artifacts),
        factChecks: factCheckService,
        skills,
        ...(capabilities ? { capabilities } : {}),
    };
}
