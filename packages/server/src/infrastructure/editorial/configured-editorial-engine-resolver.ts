import { resolveBuiltInSkillId, type BuiltInSkillId, type EditorialOperation, type ModelPreferences, type OpenAiConnection } from "@skladno/shared";

import type { EditorialEngineResolver } from "../../application/ports/editorial-engine-resolver.js";
import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import type { SettingsStore } from "../../application/ports/settings-store.js";
import type { ServerConfig } from "../configuration/config.js";
import { createEditorialEngine } from "./create-editorial-engine.js";


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
}
