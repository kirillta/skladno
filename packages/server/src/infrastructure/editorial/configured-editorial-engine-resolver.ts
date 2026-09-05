import { AI_PROVIDER, resolveBuiltInSkillId, type AiConnection, type AiProvider, type BuiltInSkillId, type EditorialOperation, type ModelPreferences, type ReasoningEffort } from "@skladno/shared";

import type { EditorialEngineResolver } from "../../application/ports/editorial-engine-resolver.js";
import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import type { SettingsStore } from "../../application/ports/settings-store.js";
import type { ServerConfig } from "../configuration/config.js";
import { createEditorialEngine } from "./create-editorial-engine.js";
import { AiSdkProposalSummaryGeneratorAdapter } from "./ai-sdk-proposal-summary-generator-adaptor.js";
import { AiSdkArticleTitleGeneratorAdapter } from "./article-title-generator.js";
import { AiSdkAssistantActionIntentVerifier } from "./ai-sdk-assistant-action-intent-verifier.js";
import type { ManagedCredentials } from "../../application/ports/managed-credentials.js";
import { createProviderModel } from "./provider-model.js";
import { editorialModelCapabilities, supportsEditorialOperation } from "./provider-capabilities.js";
import { supportingTextProviderOptions } from "./ai-sdk-editorial-helpers.js";


interface ResolvedConnection {
    apiKey: string;
    provider: AiProvider;
    connectionId: string;
    preferences: ModelPreferences;
}


export function resolveTextGenerationModel(preferences: Partial<ModelPreferences> | undefined, fallback: string): string {
    return preferences?.textGenerationModel || preferences?.defaultModel || fallback;
}


export function resolveTextGenerationConfiguration(preferences: Partial<ModelPreferences> | undefined, fallback: string): { model: string; reasoningEffort?: ReasoningEffort } {
    return {
        model: resolveTextGenerationModel(preferences, fallback),
        ...(preferences?.textGenerationReasoningEffort ? { reasoningEffort: preferences.textGenerationReasoningEffort } : {}),
    };
}


export class ConfiguredEditorialEngineResolver implements EditorialEngineResolver {
    constructor(
        private readonly config: ServerConfig,
        private readonly settings: SettingsStore,
        private readonly credentials?: ManagedCredentials,
    ) { }


    resolve(operation: EditorialOperation, assistantSkillId?: BuiltInSkillId): EditorialEngine | undefined {
        const connection = this.resolveConnection();
        if (!connection)
            return undefined;

        const skillId = assistantSkillId ?? resolveBuiltInSkillId(operation);
        const model = (skillId ? connection.preferences.skillOverrides[skillId] : undefined) || connection.preferences.defaultModel || this.config.aiModel;
        const reasoningEffort = skillId ? connection.preferences.skillReasoningEfforts?.[skillId] : connection.preferences.reasoningEffort;
        if (!supportsEditorialOperation(connection.provider, model, operation))
            return undefined;

        return createEditorialEngine({ ...connection, model, storeResponses: this.config.aiSessionContinuationEnabled, sourcedResearch: editorialModelCapabilities(connection.provider, model).sourcedResearch, ...(reasoningEffort ? { reasoningEffort } : {}) });
    }


    resolveProposalSummaryGenerator() {
        const configuration = this.resolveTextGenerationConnection();
        if (!configuration)
            return undefined;

        return new AiSdkProposalSummaryGeneratorAdapter(createProviderModel(configuration), supportingTextProviderOptions(configuration.provider, configuration.reasoningEffort));
    }


    resolveArticleTitleGenerator() {
        const configuration = this.resolveTextGenerationConnection();
        if (!configuration)
            return undefined;

        return new AiSdkArticleTitleGeneratorAdapter(createProviderModel(configuration), supportingTextProviderOptions(configuration.provider, configuration.reasoningEffort));
    }


    resolveAssistantActionIntentVerifier() {
        const configuration = this.resolveTextGenerationConnection();
        return configuration ? new AiSdkAssistantActionIntentVerifier(createProviderModel(configuration), supportingTextProviderOptions(configuration.provider, configuration.reasoningEffort)) : undefined;
    }


    private resolveTextGenerationConnection(): (ResolvedConnection & { model: string; reasoningEffort?: ReasoningEffort }) | undefined {
        const connection = this.resolveConnection();
        if (!connection)
            return undefined;

        return { ...connection, ...resolveTextGenerationConfiguration(connection.preferences, this.config.aiModel) };
    }


    private resolveConnection(): ResolvedConnection | undefined {
        const saved = this.settings.get("application-ai-connections")?.value as { connections?: AiConnection[]; activeConnectionId?: string } | undefined;
        const active = saved?.connections?.find((connection) => connection.id === saved.activeConnectionId);
        const apiKey = active ? this.connectionApiKey(active) : this.config.aiApiKey;
        if (!apiKey)
            return undefined;

        const rawPreferences = this.settings.get("application-model-preferences")?.value;
        const byConnection = rawPreferences && typeof rawPreferences === "object" && !Array.isArray(rawPreferences)
            ? (rawPreferences as { byConnection?: unknown }).byConnection
            : undefined;
        const preferences = active && byConnection && typeof byConnection === "object" && !Array.isArray(byConnection)
            ? (byConnection as Record<string, ModelPreferences>)[active.id] ?? { defaultModel: "", skillOverrides: {} }
            : rawPreferences as Partial<ModelPreferences> | undefined;

        return {
            apiKey,
            provider: active?.provider ?? AI_PROVIDER.OPENAI,
            connectionId: active?.id ?? "environment",
            preferences: { defaultModel: "", skillOverrides: {}, ...preferences },
        };
    }


    private connectionApiKey(connection: AiConnection): string | undefined {
        return connection.credentialSource.kind === "environment-variable"
            ? process.env[connection.credentialSource.environmentVariableName]
            : this.credentials?.get(connection.id);
    }
}
