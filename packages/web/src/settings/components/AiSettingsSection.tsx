import { AiConnectionsSection } from "./AiConnectionsSection.js";
import { AiModelsSection } from "./AiModelsSection.js";
import type { AiSettingsSectionProps } from "./AiSettingsTypes.js";


export function AiSettingsSection(props: AiSettingsSectionProps) {
    const settingsConnections = props.settings.connections.filter((connection): connection is NonNullable<typeof connection> => Boolean(connection));
    return <>
        <AiConnectionsSection {...props} />
        <div className="pt-8">
            <AiModelsSection preferences={props.preferences} models={props.models} settingsConnections={settingsConnections} onRefreshModels={props.onRefreshModels} savePreferences={props.savePreferences} />
        </div>
    </>;
}
