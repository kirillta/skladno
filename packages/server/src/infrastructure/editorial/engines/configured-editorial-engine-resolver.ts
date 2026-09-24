import { AI_PROVIDER, editorialOperationSkillMap, parseAiModelPreferenceId, type AiConnection, type AiProvider, type AppModelPreference, type BuiltInSkillId, type EditorialOperation, type ModelPreferences, type ReasoningEffort } from "@skladno/shared";

import type { EditorialEngineResolver } from "../../../application/editorial/engine/editorial-engine-resolver.js";
import type { EditorialEngine } from "../../../application/editorial/engine/editorial-engine.js";
import type { SettingsStore } from "../../../application/settings/settings-store.js";
import type { ServerConfig } from "../../configuration/config.js";
import { createEditorialEngine } from "./create-editorial-engine.js";
import { AiSdkProposalSummaryGeneratorAdapter } from "../adapters/ai-sdk-proposal-summary-generator-adapter.js";
import { AiSdkArticleTitleGeneratorAdapter } from "../adapters/ai-sdk-article-title-generator-adapter.js";
import { AiSdkRevisionDescriptionGeneratorAdapter } from "../adapters/ai-sdk-revision-description-generator-adapter.js";
import { AiSdkAssistantActionIntentVerifier } from "../adapters/ai-sdk-assistant-action-intent-verifier.js";
import type { CredentialStore } from "../../../application/settings/credential-store.js";
import { createProviderModel } from "../adapters/provider-model.js";
import { EditorialModelCapabilityPolicy } from "../policies/editorial-model-capability-policy.js";
import { getSupportingTextProviderOptions } from "../adapters/ai-sdk-provider.js";


interface ResolvedConnection {
    apiKey: string;
    provider: AiProvider;
    connectionId: string;
    preferences: ModelPreferences;
}


export function resolveAppModelConfiguration(appModel: AppModelPreference | undefined, preferences: Partial<ModelPreferences> | undefined, fallback: string): { model: string; reasoningEffort?: ReasoningEffort } {
    return {
        model: appModel?.model || preferences?.defaultModel || fallback,
        ...(appModel?.reasoningEffort ? { reasoningEffort: appModel.reasoningEffort } : {}),
    };
}


export class ConfiguredEditorialEngineResolver implements EditorialEngineResolver {
    private readonly modelCapabilities = new EditorialModelCapabilityPolicy();


    constructor(
        private readonly config: ServerConfig,
        private readonly settings: SettingsStore,
        private readonly credentialStore?: CredentialStore,
    ) { }


    resolve(operation: EditorialOperation, assistantSkillId?: BuiltInSkillId): EditorialEngine | undefined {
        const skillId = assistantSkillId ?? editorialOperationSkillMap[operation];
        const preferences = this.resolvePreferences();
        const connection = this.resolveModel((skillId ? preferences.skillOverrides[skillId] : undefined) || preferences.defaultModel || this.config.aiModel);
        if (!connection)
            return undefined;

        const model = connection.model;
        const reasoningEffort = skillId ? connection.preferences.skillReasoningEfforts?.[skillId] : connection.preferences.reasoningEffort;
        if (!this.modelCapabilities.supportsOperation(connection.provider, model, operation))
            return undefined;

        return createEditorialEngine({
            ...connection,
            model,
            storeResponses: this.config.aiSessionContinuationEnabled,
            sourcedResearch: this.modelCapabilities.getCapabilities(connection.provider, model).sourcedResearch,
            ...(reasoningEffort ? { reasoningEffort } : {})
        });
    }


    resolveAssistant(): EditorialEngine | undefined {
        const configuration = this.resolveAppModelConnection();
        if (!configuration)
            return undefined;

        const capabilities = this.modelCapabilities.getCapabilities(configuration.provider, configuration.model);
        return createEditorialEngine({
            ...configuration,
            storeResponses: this.config.aiSessionContinuationEnabled,
            sourcedResearch: capabilities.sourcedResearch,
        });
    }


    resolveProposalSummaryGenerator() {
        const configuration = this.resolveAppModelConnection();
        if (!configuration)
            return undefined;

        return new AiSdkProposalSummaryGeneratorAdapter(createProviderModel(configuration), getSupportingTextProviderOptions(configuration.provider, configuration.reasoningEffort));
    }


    resolveArticleTitleGenerator() {
        const configuration = this.resolveAppModelConnection();
        if (!configuration)
            return undefined;

        return new AiSdkArticleTitleGeneratorAdapter(createProviderModel(configuration), getSupportingTextProviderOptions(configuration.provider, configuration.reasoningEffort));
    }


    resolveRevisionDescriptionGenerator() {
        const configuration = this.resolveAppModelConnection();
        if (!configuration)
            return undefined;

        return new AiSdkRevisionDescriptionGeneratorAdapter(createProviderModel(configuration), getSupportingTextProviderOptions(configuration.provider, configuration.reasoningEffort));
    }


    resolveAssistantActionIntentVerifier() {
        const configuration = this.resolveAppModelConnection();
        return configuration
            ? new AiSdkAssistantActionIntentVerifier(createProviderModel(configuration), getSupportingTextProviderOptions(configuration.provider, configuration.reasoningEffort))
            : undefined;
    }


    private resolveAppModelConnection(): (ResolvedConnection & { model: string; reasoningEffort?: ReasoningEffort }) | undefined {
        const preferences = this.resolvePreferences();
        const appModelRecord = this.settings.getSetting("application-app-model");
        const savedAppModel = appModelRecord?.value as AppModelPreference | undefined;
        const legacyAppModel = appModelRecord ? undefined : (this.settings.getSetting("application-model-preferences")?.value as { appModel?: AppModelPreference } | undefined)?.appModel;
        const configuration = resolveAppModelConfiguration(savedAppModel ?? legacyAppModel, preferences, this.config.aiModel);
        const connection = this.resolveModel(configuration.model);
        if (!connection)
            return undefined;

        return { ...connection, model: connection.model, ...(configuration.reasoningEffort ? { reasoningEffort: configuration.reasoningEffort } : {}) };
    }


    private resolvePreferences(): ModelPreferences {
        const saved = this.settings.getSetting("application-ai-connections")?.value as { connections?: AiConnection[]; activeConnectionId?: string } | undefined;
        const rawPreferences = this.settings.getSetting("application-model-preferences")?.value;
        const byConnection = rawPreferences && typeof rawPreferences === "object" && !Array.isArray(rawPreferences)
            ? (rawPreferences as { byConnection?: unknown }).byConnection
            : undefined;
        const preferences = saved?.activeConnectionId && byConnection && typeof byConnection === "object" && !Array.isArray(byConnection)
            ? (byConnection as Record<string, ModelPreferences>)[saved.activeConnectionId] ?? { defaultModel: "", skillOverrides: {} }
            : rawPreferences as Partial<ModelPreferences> | undefined;

        return { defaultModel: "", skillOverrides: {}, ...preferences };
    }


    private resolveModel(preference: string): (ResolvedConnection & { model: string }) | undefined {
        const saved = this.settings.getSetting("application-ai-connections")?.value as { connections?: AiConnection[]; activeConnectionId?: string } | undefined;
        const selected = parseAiModelPreferenceId(preference);
        if (!selected) {
            const legacyConnection = saved?.connections?.find((item) => item.id === saved.activeConnectionId && item.active !== false);
            const apiKey = legacyConnection ? this.connectionApiKey(legacyConnection) : this.config.aiApiKey;
            if (!apiKey)
                return undefined;

            return {
                apiKey,
                provider: legacyConnection?.provider ?? AI_PROVIDER.OPENAI,
                connectionId: legacyConnection?.id ?? "environment",
                preferences: this.resolvePreferences(),
                model: preference || this.config.aiModel
            };
        }

        const connection = saved?.connections?.find((item) => item.id === selected.connectionId && item.active !== false);
        const apiKey = connection ? this.connectionApiKey(connection) : undefined;
        if (!connection || !apiKey)
            return undefined;

        return { apiKey, provider: connection.provider, connectionId: connection.id, preferences: this.resolvePreferences(), model: selected.model };
    }


    private connectionApiKey(connection: AiConnection): string | undefined {
        return connection.credentialSource.kind === "environment-variable"
            ? process.env[connection.credentialSource.environmentVariableName]
            : this.credentialStore?.get(connection.id);
    }
}
