import { APPLICATION_ERROR, HTTP_STATUS, type AiConnection } from "@skladno/shared";

import { ApplicationServiceError } from "../../application/errors/application-service-error.js";


const modelsEndpoints: Record<string, string> = {
    openai: "https://api.openai.com/v1/models",
};

const editorialModelFamilies = ["gpt-5.5", "gpt-5.6"];


export function editorialModels(models: string[]): string[] {
    return models.filter((model) => editorialModelFamilies.some((family) => model === family || model.startsWith(`${family}-`))).sort();
}


function modelsEndpoint(provider: string): string {
    const endpoint = modelsEndpoints[provider];
    if (!endpoint)
        throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_VERIFICATION_FAILED, HTTP_STATUS.BAD_REQUEST);

    return endpoint;
}


export async function listAvailableModels(connection: AiConnection, apiKey = connection.credentialSource.kind === "environment-variable" ? process.env[connection.credentialSource.environmentVariableName] : undefined): Promise<string[]> {
    const provider = connection.provider;
    if (!apiKey)
        throw new ApplicationServiceError(APPLICATION_ERROR.ENVIRONMENT_VARIABLE_UNAVAILABLE, HTTP_STATUS.BAD_REQUEST);

    const response = await fetch(modelsEndpoint(provider), { headers: { authorization: `Bearer ${apiKey}` } });
    if (!response.ok)
        throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_VERIFICATION_FAILED, HTTP_STATUS.BAD_REQUEST);

    const body = await response.json() as { data?: { id?: unknown }[] };
    return editorialModels((body.data ?? []).map((model) => model.id).filter((id): id is string => typeof id === "string"));
}
