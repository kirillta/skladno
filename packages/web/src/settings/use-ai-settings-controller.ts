import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { IntlShape } from "react-intl";
import { getAiModelPreferenceId, AI_PROVIDER, type AiConnection, type AiProvider, type ApplicationSettingsSnapshot, type AvailableAiModel } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application/client.js";
import { useNotifications } from "../notifications/NotificationProvider.js";
import type { DesktopSettingsClient } from "@skladno/shared";


function isAvailableAiModel(value: unknown): value is AvailableAiModel {
    if (!value || typeof value !== "object")
        return false;

    return "id" in value && typeof value.id === "string" && "model" in value && typeof value.model === "string";
}


function getAvailableModels(value: unknown, connections: AiConnection[]): AvailableAiModel[] {
    const fallback = connections.find((connection) => connection.active !== false);
    return Array.isArray(value) ? value.flatMap((item): AvailableAiModel[] => {
        if (typeof item === "string" && fallback)
            return [{ id: getAiModelPreferenceId(fallback.id, item), model: item, connectionId: fallback.id, provider: fallback.provider }];

        return isAvailableAiModel(item) ? [item] : [];
    }) : [];
}


interface AiSettingsControllerInput {
    client: EditorialWorkspaceClient;
    intl: IntlShape;
    settings: ApplicationSettingsSnapshot | undefined;
    desktopSettings: DesktopSettingsClient | undefined;
    setSettings: Dispatch<SetStateAction<ApplicationSettingsSnapshot | undefined>>;
    setStatus: Dispatch<SetStateAction<string>>;
    aiSettingsOpen: boolean;
}


export function useAiSettingsController({ client, intl, settings, desktopSettings, setSettings, setStatus, aiSettingsOpen }: AiSettingsControllerInput) {
    const { notifyError } = useNotifications();
    const [models, setModels] = useState<AvailableAiModel[]>([]);
    const [connectionProvider, setConnectionProvider] = useState<AiProvider>(AI_PROVIDER.OPENAI);
    const [connectionName, setConnectionName] = useState("");
    const [environmentName, setEnvironmentName] = useState("");
    const [managedConnectionName, setManagedConnectionName] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [connectionError, setConnectionError] = useState<string>();
    const [connectionPendingRemoval, setConnectionPendingRemoval] = useState<AiConnection>();
    const [connectionPendingRename, setConnectionPendingRename] = useState<AiConnection>();
    const [renamedConnectionLabel, setRenamedConnectionLabel] = useState("");

    const addConnection = async () => {
        setConnectionError(undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await client.addAiConnection({ provider: connectionProvider, label: connectionName, environmentVariableName: environmentName });
            setSettings((current) => current ? { ...current, connections: [...current.connections, connection] } : current);
            setConnectionName("");
            setEnvironmentName("");
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionAddFailed" }) });
        }
    };

    const addManagedConnection = async () => {
        if (!desktopSettings)
            return;

        setConnectionError(undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await desktopSettings.addManagedAiConnection({ provider: connectionProvider, label: managedConnectionName, apiKey });
            setSettings((current) => current ? { ...current, connections: [...current.connections, connection] } : current);
            setManagedConnectionName("");
            setApiKey("");
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionAddFailed" }) });
        }
    };

    const setConnectionActive = async (connectionId: string, active: boolean) => {
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await client.setAiConnectionActive(connectionId, active);
            setSettings((current) => current ? { ...current, connections: current.connections.map((item) => item.id === connection.id ? connection : item) } : current);
            setModels([]);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionUpdateFailed" }) });
        }
    };

    const renameManagedConnection = async () => {
        if (!connectionPendingRename)
            return;

        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const source = connectionPendingRename.credentialSource;
            let connection: AiConnection;
            if (source.kind === "managed") {
                if (!desktopSettings)
                    return;

                connection = await desktopSettings.renameManagedAiConnection(connectionPendingRename.id, renamedConnectionLabel);
            } else {
                connection = await client.updateAiConnection(connectionPendingRename.id, { label: renamedConnectionLabel, environmentVariableName: source.environmentVariableName });
            }

            setSettings((current) => current ? { ...current, connections: current.connections.map((item) => item.id === connection.id ? connection : item) } : current);
            setConnectionPendingRename(undefined);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionUpdateFailed" }) });
        }
    };

    const requestManagedConnectionRename = (connection: AiConnection) => {
        setConnectionPendingRename(connection);
        setRenamedConnectionLabel(connection.label);
    };

    const removeConnection = async () => {
        if (!connectionPendingRemoval)
            return;

        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.removeAiConnection(connectionPendingRemoval.id);
            setSettings((current) => current ? { ...current, connections: current.connections.filter((connection) => connection.id !== connectionPendingRemoval.id) } : current);
            setConnectionPendingRemoval(undefined);
            setModels([]);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionRemoveFailed" }) });
        }
    };

    const refreshModels = useCallback(async () => {
        try {
            setModels(getAvailableModels(await client.refreshAiModels(), settings?.connections ?? []));
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.modelsLoadFailed" }) });
        }
    }, [client, intl, notifyError, settings?.connections]);

    useEffect(() => {
        if (!aiSettingsOpen || !settings?.connections.some((connection) => connection.active !== false))
            return;

        void refreshModels();
    }, [aiSettingsOpen, refreshModels, settings?.connections]);

    return {
        models,
        connectionProvider,
        connectionName,
        environmentName,
        managedConnectionName,
        apiKey,
        connectionError,
        connectionPendingRemoval,
        connectionPendingRename,
        renamedConnectionLabel,
        setConnectionProvider,
        setConnectionName,
        setEnvironmentName: (value: string) => {
            setEnvironmentName(value);
            setConnectionError(undefined);
        },
        setManagedConnectionName,
        setApiKey,
        setConnectionPendingRemoval,
        setConnectionPendingRename,
        setRenamedConnectionLabel,
        addConnection,
        addManagedConnection,
        setConnectionActive,
        renameManagedConnection,
        requestManagedConnectionRename,
        removeConnection,
        refreshModels,
    };
}
