export interface AvailableModelsProvider {
    list(provider: string, environmentVariableName: string): Promise<string[]>;
}
