import { isDateFormatPreference, isThemePreference, isTimeFormatPreference, isTimeZonePreference, type GeneralSettings } from "@skladno/shared";
import { useIntl } from "react-intl";
import { catalogByLocale, installedLocaleCatalogs } from "../../i18n/catalogs.js";
import { formatDate, formatDateTime, formatTime, formatTimeZoneLabel, systemTimeZone, timeZoneOptions } from "../../i18n/formatting.js";
import { Select, Button } from "../../ui/primitives.js";
import { SettingRow } from "./SettingRow.js";


function formatExample(general: GeneralSettings): string {
    return formatDateTime(new Date(), general.interfaceLocale, general.dateFormat, general.timeFormat, general.timeZone);
}


function formatSystemDateExample(general: GeneralSettings): string {
    return formatDate(new Date(), "system", general.timeZone);
}


function formatSystemTimeExample(general: GeneralSettings): string {
    return formatTime(new Date(), general.interfaceLocale, "system", general.timeZone);
}


function isInterfaceLocale(value: string): value is GeneralSettings["interfaceLocale"] {
    return installedLocaleCatalogs.some((catalog) => catalog.code === value);
}


export function GeneralSettingsSection({ general, save, applyTheme }: { general: GeneralSettings; save: (next: GeneralSettings) => Promise<void>; applyTheme?: (theme: GeneralSettings["theme"]) => void }) {
    const intl = useIntl();

    return <>
        <section aria-labelledby="settings-appearance-and-language">
            <h2 id="settings-appearance-and-language" className="mt-8 text-base font-semibold">{intl.formatMessage({ id: "settings.appearanceAndLanguage" })}</h2>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.preferredAppearance" })} hint={intl.formatMessage({ id: "settings.appearanceHint" })} action={<Button variant="quiet" onClick={() => applyTheme?.(general.theme)}>{intl.formatMessage({ id: "settings.applyAppearance" })}</Button>}>
                <Select value={general.theme} onChange={(event) => {
                    const value = event.target.value;
                    if (isThemePreference(value))
                        void save({ ...general, theme: value });
                }}>
                    <option value="system">{intl.formatMessage({ id: "settings.system" })}</option>
                    <option value="light">{intl.formatMessage({ id: "settings.light" })}</option>
                    <option value="dark">{intl.formatMessage({ id: "settings.dark" })}</option>
                </Select>
            </SettingRow>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.interfaceLanguage" })} hint={intl.formatMessage({ id: "settings.interfaceLanguageHint" })}>
                <Select value={catalogByLocale.has(general.interfaceLocale) ? general.interfaceLocale : "en"} disabled={installedLocaleCatalogs.length === 1} onChange={(event) => {
                    const value = event.target.value;
                    if (isInterfaceLocale(value))
                        void save({ ...general, interfaceLocale: value });
                }}>{installedLocaleCatalogs.map((catalog) => <option key={catalog.code} value={catalog.code}>{intl.formatMessage({ id: catalog.nameMessageId })}</option>)}
                </Select>
            </SettingRow>
        </section>
        <section className="mt-8 border-t border-border pt-8" aria-labelledby="settings-date-and-time">
            <h2 id="settings-date-and-time" className="text-base font-semibold">{intl.formatMessage({ id: "settings.dateAndTime" })}</h2>
            <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.example" }, { value: formatExample(general) })}</p>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.dateFormat" })} hint={intl.formatMessage({ id: "settings.dateFormatHint" })} action={<Button variant="quiet" disabled={general.dateFormat === "system"} onClick={() => void save({ ...general, dateFormat: "system" })}>{intl.formatMessage({ id: "settings.resetDateFormat" })}</Button>}>
                <Select value={general.dateFormat} onChange={(event) => {
                    const value = event.target.value;
                    if (isDateFormatPreference(value))
                        void save({ ...general, dateFormat: value });
                }}>
                    <option value="system">{intl.formatMessage({ id: "settings.systemDateFormat" }, { value: formatSystemDateExample(general) })}</option>
                    <option value="day-first">{intl.formatMessage({ id: "settings.dayFirstSlash" })}</option>
                    <option value="day-first-dots">{intl.formatMessage({ id: "settings.dayFirstDots" })}</option>
                    <option value="month-first">{intl.formatMessage({ id: "settings.monthFirstSlash" })}</option>
                    <option value="iso">{intl.formatMessage({ id: "settings.isoDate" })}</option>
                </Select>
            </SettingRow>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.timeFormat" })} hint={intl.formatMessage({ id: "settings.timeFormatHint" })} action={<Button variant="quiet" disabled={general.timeFormat === "system"} onClick={() => void save({ ...general, timeFormat: "system" })}>{intl.formatMessage({ id: "settings.resetTimeFormat" })}</Button>}>
                <Select value={general.timeFormat} onChange={(event) => {
                    const value = event.target.value;
                    if (isTimeFormatPreference(value))
                        void save({ ...general, timeFormat: value });
                }}>
                    <option value="system">{intl.formatMessage({ id: "settings.systemTimeFormat" }, { value: formatSystemTimeExample(general) })}</option>
                    <option value="12-hour">{intl.formatMessage({ id: "settings.twelveHour" })}</option>
                    <option value="24-hour">{intl.formatMessage({ id: "settings.twentyFourHour" })}</option>
                </Select>
            </SettingRow>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.timeZone" })} hint={intl.formatMessage({ id: "settings.timeZoneHint" })} action={<Button variant="quiet" disabled={general.timeZone === "system"} onClick={() => void save({ ...general, timeZone: "system" })}>{intl.formatMessage({ id: "settings.resetTimeZone" })}</Button>}>
                <Select value={general.timeZone} onChange={(event) => {
                    const value = event.target.value;
                    if (isTimeZonePreference(value))
                        void save({ ...general, timeZone: value });
                }}>
                    <option value="system">{intl.formatMessage({ id: "settings.systemTimeZone" }, { timeZone: systemTimeZone() ? formatTimeZoneLabel(systemTimeZone()!) : intl.formatMessage({ id: "settings.localTimeZone" }) })}</option>
                    {timeZoneOptions(general.timeZone).map((timeZone) => <option key={timeZone.value} value={timeZone.value}>{timeZone.label}</option>)}
                </Select>
            </SettingRow>
        </section>
    </>;
}
