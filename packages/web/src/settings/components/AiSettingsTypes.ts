import type { AiConnection, AiProvider, AppModelPreference, ApplicationSettingsSnapshot, AvailableAiModel, GeneralSettings, ModelPreferences } from "@skladno/shared";


export interface AiSettingsSectionProps {
    settings: ApplicationSettingsSnapshot;
    general: GeneralSettings;
    saveGeneral: (next: GeneralSettings) => Promise<void>;
    preferences: ModelPreferences;
    appModel?: AppModelPreference;
    models: AvailableAiModel[];
    connectionProvider: AiProvider;
    connectionName: string;
    environmentName: string;
    managedConnectionName: string;
    apiKey: string;
    connectionError?: string;
    setConnectionProvider: (value: AiProvider) => void;
    setConnectionName: (value: string) => void;
    setEnvironmentName: (value: string) => void;
    setManagedConnectionName: (value: string) => void;
    setApiKey: (value: string) => void;
    onAddConnection: () => void;
    onAddManagedConnection?: () => void;
    onSetConnectionActive: (connectionId: string, active: boolean) => void;
    onRequestConnectionRename?: (connection: AiConnection) => void;
    canRenameManagedConnection: boolean;
    onRequestConnectionRemoval: (connection: AiConnection) => void;
    onRefreshModels: () => void;
    savePreferences: (next: ModelPreferences) => Promise<void>;
    saveAppModel: (next: AppModelPreference | null) => Promise<void>;
}
