import { useIntl } from "react-intl";
import type { GeneralSettings } from "@skladno/shared";
import { Select } from "../../ui/primitives.js";
import { SettingRow, SettingsGroup } from "./SettingRow.js";

const assistantRequestTimeoutOptions = [1, 2, 3, 5, 10, 15, 30] as const;


export function AssistantBehaviorSettings({ general, save }: { general: GeneralSettings; save: (next: GeneralSettings) => Promise<void> }) {
    const intl = useIntl();
    return <SettingsGroup label={intl.formatMessage({ id: "settings.assistantBehavior" })}>
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.defaultAssistantEditMode" })} hint={intl.formatMessage({ id: "settings.defaultAssistantEditModeHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.defaultAssistantEditMode" })} value={general.defaultAssistantEditMode} onChange={(event) => void save({ ...general, defaultAssistantEditMode: event.target.value === "direct" ? "direct" : "review" })}>
                <option value="review">{intl.formatMessage({ id: "assistant.editMode.review" })}</option>
                <option value="direct">{intl.formatMessage({ id: "assistant.editMode.direct" })}</option>
            </Select>
        </SettingRow>
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.assistantRequestTimeout" })} hint={intl.formatMessage({ id: "settings.assistantRequestTimeoutHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.assistantRequestTimeout" })} value={general.assistantRequestTimeoutMinutes} onChange={(event) => void save({ ...general, assistantRequestTimeoutMinutes: event.target.value === "unlimited" ? "unlimited" : Number(event.target.value) })}>
                {assistantRequestTimeoutOptions.map((minutes) => <option key={minutes} value={minutes}>{intl.formatMessage({ id: "settings.requestTimeoutMinutes" }, { minutes })}</option>)}
                <option value="unlimited">{intl.formatMessage({ id: "settings.requestTimeoutUnlimited" })}</option>
            </Select>
        </SettingRow>
    </SettingsGroup>;
}
