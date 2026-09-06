import { useIntl } from "react-intl";
import { getDesktopSettingsClient, getDesktopUpdateClient } from "../../desktop-client.js";
import { SettingsGroup } from "./SettingRow.js";
import { UpdatesSettingsGroup } from "./UpdatesSettingsGroup.js";


const repositoryUrl = "https://github.com/kirillta/skladno";


export function AboutSettingsSection() {
    const intl = useIntl();

    return <>
        <p className="mt-2 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.aboutDescription" })}</p>
        <SettingsGroup label={intl.formatMessage({ id: "settings.projectResources" })}>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <a className="inline-flex min-h-9 items-center text-sm font-semibold text-brand underline underline-offset-2" href={repositoryUrl} target="_blank" rel="noreferrer">{intl.formatMessage({ id: "settings.sourceCode" })}</a>
                <a className="inline-flex min-h-9 items-center text-sm font-semibold text-brand underline underline-offset-2" href={`${repositoryUrl}/issues`} target="_blank" rel="noreferrer">{intl.formatMessage({ id: "settings.reportProblem" })}</a>
                <a className="inline-flex min-h-9 items-center text-sm font-semibold text-brand underline underline-offset-2" href={`${repositoryUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer">{intl.formatMessage({ id: "settings.mitLicense" })}</a>
            </div>
        </SettingsGroup>
        <div id="settings-updates" tabIndex={-1} />
        <UpdatesSettingsGroup client={getDesktopUpdateClient()} desktop={Boolean(getDesktopSettingsClient())} />
    </>;
}
