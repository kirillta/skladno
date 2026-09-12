import type { AiConnection } from "@skladno/shared";


export interface AvailableModelsProvider {
    list(connection: AiConnection, apiKey?: string): Promise<string[]>;
}
