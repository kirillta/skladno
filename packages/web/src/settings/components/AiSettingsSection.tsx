import { AssistantBehaviorSettings } from "./AssistantBehaviorSettings.js";
import { AiConnectionsSection } from "./AiConnectionsSection.js";
import { AiModelsSection } from "./AiModelsSection.js";
import type { AiSettingsSectionProps } from "./AiSettingsTypes.js";


export function AiSettingsSection(props: AiSettingsSectionProps) {
    const settingsConnections = props.settings.connections.filter((connection): connection is NonNullable<typeof connection> => Boolean(connection));
    return <>
        <AssistantBehaviorSettings general={props.general} save={props.saveGeneral} />
        <AiConnectionsSection {...props} />
        <div className="pt-8">
            <AiModelsSection data={{ preferences: props.preferences, appModel: props.appModel, models: props.models, settingsConnections }} actions={{ onRefreshModels: props.onRefreshModels, savePreferences: props.savePreferences, saveAppModel: props.saveAppModel }} />
        </div>
    </>;
}
