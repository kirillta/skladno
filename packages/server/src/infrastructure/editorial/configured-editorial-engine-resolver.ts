import { resolveBuiltInSkillId, type BuiltInSkillId, type EditorialOperation, type ModelPreferences, type OpenAiConnection } from "@skladno/shared";

import type { EditorialEngineResolver } from "../../application/ports/editorial-engine-resolver.js";
import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import type { SettingsStore } from "../../application/ports/settings-store.js";
import type { ServerConfig } from "../configuration/config.js";
import { createEditorialEngine } from "./create-editorial-engine.js";
import { ProposalSummaryGeneratorAdapter } from "./proposal-summary-generator.js";
import { ArticleTitleGeneratorAdapter } from "./article-title-generator.js";


export function resolveTextGenerationModel(preferences: Partial<ModelPreferences> | undefined, fallback: string): string {
    return preferences?.textGenerationModel || preferences?.defaultModel || fallback;
}


export class ConfiguredEditorialEngineResolver implements EditorialEngineResolver {
    constructor(
        private readonly config: ServerConfig,
        private readonly settings: SettingsStore,
    ) { }


    resolve(operation: EditorialOperation, assistantSkillId?: BuiltInSkillId): EditorialEngine | undefined {
        const savedConnections = this.settings.get("application-ai-connections")?.value as { connections?: OpenAiConnection[]; activeConnectionId?: string } | undefined;
        const active = savedConnections?.connections?.find((connection) => connection.id === savedConnections.activeConnectionId);
        const apiKey = active ? process.env[active.environmentVariableName] : this.config.aiApiKey;
        if (!apiKey)
            return undefined;

        const preferences = this.settings.get("application-model-preferences")?.value as Partial<ModelPreferences> | undefined;
        const skillId = assistantSkillId ?? resolveBuiltInSkillId(operation);
        const model = (skillId ? preferences?.skillOverrides?.[skillId] : undefined) || preferences?.defaultModel || this.config.aiModel;

        return createEditorialEngine({ apiKey, model, storeResponses: this.config.aiSessionContinuationEnabled });
    }


    resolveProposalSummaryGenerator() {
        const configuration = this.resolveTextGenerationConfiguration();
        if (!configuration)
            return undefined;

        return new ProposalSummaryGeneratorAdapter(configuration.apiKey, configuration.model);
    }


    resolveArticleTitleGenerator() {
        const configuration = this.resolveTextGenerationConfiguration();
        if (!configuration)
            return undefined;

        return new ArticleTitleGeneratorAdapter(configuration.apiKey, configuration.model);
    }


    private resolveTextGenerationConfiguration(): { apiKey: string; model: string } | undefined {
        const savedConnections = this.settings.get("application-ai-connections")?.value as { connections?: OpenAiConnection[]; activeConnectionId?: string } | undefined;
        const active = savedConnections?.connections?.find((connection) => connection.id === savedConnections.activeConnectionId);
        const apiKey = active ? process.env[active.environmentVariableName] : this.config.aiApiKey;
        if (!apiKey)
            return undefined;

        const preferences = this.settings.get("application-model-preferences")?.value as Partial<ModelPreferences> | undefined;
        return { apiKey, model: resolveTextGenerationModel(preferences, this.config.aiModel) };
    }
}
