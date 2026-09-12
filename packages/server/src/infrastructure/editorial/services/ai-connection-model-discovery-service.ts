import { APPLICATION_ERROR, AI_PROVIDER, HTTP_STATUS, type AiConnection, type AiProvider } from "@skladno/shared";

import { ApplicationServiceError } from "../../../application/errors/application-service-error.js";


const modelsEndpoints: Record<AiProvider, string> = {
    [AI_PROVIDER.OPENAI]: "https://api.openai.com/v1/models",
    [AI_PROVIDER.OPENCODE]: "https://opencode.ai/zen/v1/models",
    [AI_PROVIDER.ANTHROPIC]: "https://api.anthropic.com/v1/models?limit=1000",
    [AI_PROVIDER.GOOGLE]: "https://generativelanguage.googleapis.com/v1beta/models",
    [AI_PROVIDER.XAI]: "https://api.x.ai/v1/models",
    [AI_PROVIDER.DEEPSEEK]: "https://api.deepseek.com/models",
};

const editorialModelFamilies = ["gpt-5.5", "gpt-5.6", "gpt-6"];


function requestOptions(provider: AiProvider, apiKey: string): RequestInit {
    if (provider === AI_PROVIDER.ANTHROPIC)
        return { headers: { "anthropic-version": "2023-06-01", "x-api-key": apiKey } };

    if (provider === AI_PROVIDER.GOOGLE)
        return { headers: { "x-goog-api-key": apiKey } };

    return { headers: { authorization: `Bearer ${apiKey}` } };
}


function normalizeModelId(id: string, provider: AiProvider): string {
    return provider === AI_PROVIDER.GOOGLE ? id.replace(/^models\//, "") : id;
}


function modelIds(body: unknown, provider: AiProvider): string[] {
    if (!body || typeof body !== "object")
        return [];

    const collection = provider === AI_PROVIDER.GOOGLE
        ? Reflect.get(body, "models")
        : Reflect.get(body, "data");
    if (!Array.isArray(collection))
        return [];

    return collection.flatMap((model) => {
        if (!model || typeof model !== "object")
            return [];

        const id = Reflect.get(model, "id") ?? Reflect.get(model, "name");
        if (typeof id !== "string" || !id.trim())
            return [];

        return [normalizeModelId(id, provider)];
    });
}


export class AiConnectionModelDiscoveryService {
    async list(connection: AiConnection, apiKey = connection.credentialSource.kind === "environment-variable" ? process.env[connection.credentialSource.environmentVariableName] : undefined, fetchImplementation: typeof fetch = fetch): Promise<string[]> {
        const provider = connection.provider;
        if (!apiKey)
            throw new ApplicationServiceError(APPLICATION_ERROR.ENVIRONMENT_VARIABLE_UNAVAILABLE, HTTP_STATUS.BAD_REQUEST);

        const response = await fetchImplementation(modelsEndpoints[provider], requestOptions(provider, apiKey));
        if (!response.ok)
            throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_VERIFICATION_FAILED, HTTP_STATUS.BAD_REQUEST);

        try {
            const models = modelIds(await response.json(), provider);
            return provider === AI_PROVIDER.OPENAI
                ? this.filterOpenAiEditorialModels(models)
                : [...new Set(models)].sort();
        } catch {
            return [];
        }
    }


    filterOpenAiEditorialModels(models: string[]): string[] {
        return models.filter((model) => editorialModelFamilies.some((family) => model === family || model.startsWith(`${family}-`))).sort();
    }
}
