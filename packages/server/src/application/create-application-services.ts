import type { ApplicationServices } from "./application-services.js";
import { ArticleService } from "./articles/article-service.js";
import { AssistantService } from "./assistant/assistant-service.js";
import type { AvailableModelsProvider } from "./settings/available-models-provider.js";
import type { BackupManager } from "./settings/backup-manager.js";
import type { AssistantArtifactStore } from "./assistant/assistant-artifact-store.js";
import type { AssistantStore } from "./assistant/assistant-store.js";
import type { EditorialEngineResolver } from "./editorial/engine/editorial-engine-resolver.js";
import { PublishingService } from "./publishing/publishing-service.js";
import { StyleCorpusService } from "./editorial/style/style-corpus-service.js";
import { ApplicationSettingsService } from "./settings/application-settings-service.js";
import { ProposalSummaryService } from "./editorial/proposals/proposal-summary-service.js";
import { FactCheckService } from "./editorial/fact-checking/fact-check-service.js";
import type { ArticleStore } from "./articles/article-store.js";
import type { SettingsStore } from "./settings/settings-store.js";
import type { StyleCorpusStore } from "./editorial/style/style-corpus-store.js";
import type { SystemDateTimeFormatProvider } from "./settings/system-date-time-format-provider.js";
import type { CredentialStore } from "./settings/credential-store.js";
import { EditorialCapabilityCatalog } from "./assistant/capabilities/editorial-capability-catalog.js";
import { AssistantCapabilityLoop } from "./assistant/capabilities/assistant-capability-loop.js";
import { AssistantCompletion } from "./assistant/completion/assistant-completion.js";
import { AssistantRequestPreparation } from "./assistant/requests/assistant-request-preparation.js";
import { getConversationHistory } from "./assistant/requests/conversation-history.js";
import { AssistantSkillCatalog, builtInSkillSource } from "./assistant/skills/assistant-skill-catalog.js";
import type { EditorialService } from "./editorial/editorial-service.js";
import type { TelemetryObserver } from "./telemetry/telemetry-observer.js";


interface ApplicationServiceStores {
    articles: ArticleStore;
    styleCorpus: StyleCorpusStore;
    assistant: AssistantStore;
    artifacts: AssistantArtifactStore;
    engines: EditorialEngineResolver;
    factChecks?: ConstructorParameters<typeof FactCheckService>[0] & { saveFactCheckRun(artifactId: string, articleId: string, revisionId: string): void };
}


interface ApplicationSettingsDependencies {
    settings: SettingsStore;
    dateTimeFormat: SystemDateTimeFormatProvider;
    models: AvailableModelsProvider;
    createConnectionId: () => string;
    backups?: BackupManager;
    credentialStore?: CredentialStore;
}


interface ApplicationServiceIntegration {
    editorial?: EditorialService;
    telemetry?: TelemetryObserver;
}


export interface CreateApplicationServicesOptions {
    stores: ApplicationServiceStores;
    settings: ApplicationSettingsDependencies;
    integration?: ApplicationServiceIntegration;
}


export function createApplicationServices({ stores, settings, integration = {} }: CreateApplicationServicesOptions): ApplicationServices {
    const factChecks = stores.factChecks ?? { listFactChecks: () => [], resolveFactCheckFinding: () => undefined, saveFactCheckRun: () => undefined };
    const articleService = new ArticleService(stores.articles, stores.assistant, integration.telemetry);
    const publishing = new PublishingService(settings.settings);
    const factCheckService = new FactCheckService(factChecks);
    const styleCorpusService = new StyleCorpusService(stores.styleCorpus, stores.engines, stores.articles);
    const capabilities = integration.editorial
        ? new EditorialCapabilityCatalog(articleService, stores.artifacts, publishing, integration.editorial, styleCorpusService, factChecks, stores.assistant)
        : undefined;
    const skills = new AssistantSkillCatalog([builtInSkillSource]);
    const preparation = new AssistantRequestPreparation({ articles: stores.articles, assistant: stores.assistant, styleCorpus: stores.styleCorpus, engines: stores.engines, capabilities });
    const capabilityLoop = new AssistantCapabilityLoop({ assistant: stores.assistant, engines: stores.engines, capabilities, skills, conversationHistory: (articleId, limit) => getConversationHistory(stores.assistant, articleId, limit) });
    const completion = new AssistantCompletion({ articles: stores.articles, assistant: stores.assistant, styleCorpus: stores.styleCorpus, artifacts: stores.artifacts, factChecks, capabilities });

    return {
        articles: articleService,
        assistant: new AssistantService({ assistant: stores.assistant, styleCorpus: stores.styleCorpus, factChecks, settings: settings.settings }, integration.telemetry, preparation, capabilityLoop, completion),
        settings: new ApplicationSettingsService(settings.settings, settings.dateTimeFormat, settings.models, settings.createConnectionId, settings.backups, settings.credentialStore),
        publishing,
        styleCorpus: styleCorpusService,
        proposalSummaries: new ProposalSummaryService(stores.engines, stores.artifacts),
        factChecks: factCheckService,
        skills,
        ...(capabilities ? { capabilities } : {}),
    };
}
