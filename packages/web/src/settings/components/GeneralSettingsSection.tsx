import type { GeneralSettings } from "@skladno/shared";
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


export function GeneralSettingsSection({ general, save }: { general: GeneralSettings; save: (next: GeneralSettings) => Promise<void> }) {
    const intl = useIntl();

    return <>
        <SettingRow label={intl.formatMessage({ id: "settings.preferredAppearance" })} hint={intl.formatMessage({ id: "settings.appearanceHint" })}><Select value={general.theme} onChange={(event) => void save({ ...general, theme: event.target.value as GeneralSettings["theme"] })}><option value="system">{intl.formatMessage({ id: "settings.system" })}</option><option value="light">{intl.formatMessage({ id: "settings.light" })}</option><option value="dark">{intl.formatMessage({ id: "settings.dark" })}</option></Select></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.interfaceLanguage" })} hint={intl.formatMessage({ id: "settings.interfaceLanguageHint" })}><Select value={catalogByLocale.has(general.interfaceLocale) ? general.interfaceLocale : "en"} disabled={installedLocaleCatalogs.length === 1} onChange={(event) => void save({ ...general, interfaceLocale: event.target.value as GeneralSettings["interfaceLocale"] })}>{installedLocaleCatalogs.map((catalog) => <option key={catalog.code} value={catalog.code}>{intl.formatMessage({ id: catalog.nameMessageId })}</option>)}</Select></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.dateFormat" })} hint={intl.formatMessage({ id: "settings.dateFormatHint" })} action={<Button variant="quiet" disabled={general.dateFormat === "system"} onClick={() => void save({ ...general, dateFormat: "system" })}>{intl.formatMessage({ id: "settings.resetDateFormat" })}</Button>}><Select value={general.dateFormat} onChange={(event) => void save({ ...general, dateFormat: event.target.value as GeneralSettings["dateFormat"] })}><option value="system">{intl.formatMessage({ id: "settings.systemDateFormat" }, { value: formatSystemDateExample(general) })}</option><option value="day-first">{intl.formatMessage({ id: "settings.dayFirstSlash" })}</option><option value="day-first-dots">{intl.formatMessage({ id: "settings.dayFirstDots" })}</option><option value="month-first">{intl.formatMessage({ id: "settings.monthFirstSlash" })}</option><option value="iso">{intl.formatMessage({ id: "settings.isoDate" })}</option></Select></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.timeFormat" })} hint={intl.formatMessage({ id: "settings.timeFormatHint" })} action={<Button variant="quiet" disabled={general.timeFormat === "system"} onClick={() => void save({ ...general, timeFormat: "system" })}>{intl.formatMessage({ id: "settings.resetTimeFormat" })}</Button>} status={intl.formatMessage({ id: "settings.example" }, { value: formatExample(general) })}><Select value={general.timeFormat} onChange={(event) => void save({ ...general, timeFormat: event.target.value as GeneralSettings["timeFormat"] })}><option value="system">{intl.formatMessage({ id: "settings.systemTimeFormat" }, { value: formatSystemTimeExample(general) })}</option><option value="12-hour">{intl.formatMessage({ id: "settings.twelveHour" })}</option><option value="24-hour">{intl.formatMessage({ id: "settings.twentyFourHour" })}</option></Select></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.timeZone" })} hint={intl.formatMessage({ id: "settings.timeZoneHint" })} action={<Button variant="quiet" disabled={general.timeZone === "system"} onClick={() => void save({ ...general, timeZone: "system" })}>{intl.formatMessage({ id: "settings.resetTimeZone" })}</Button>}><Select value={general.timeZone} onChange={(event) => void save({ ...general, timeZone: event.target.value })}><option value="system">{intl.formatMessage({ id: "settings.systemTimeZone" }, { timeZone: systemTimeZone() ? formatTimeZoneLabel(systemTimeZone()!) : intl.formatMessage({ id: "settings.localTimeZone" }) })}</option>{timeZoneOptions(general.timeZone).map((timeZone) => <option key={timeZone.value} value={timeZone.value}>{timeZone.label}</option>)}</Select></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} hint={intl.formatMessage({ id: "settings.defaultArticleLanguageHint" })}><Select value={general.defaultArticleLanguage} onChange={(event) => void save({ ...general, defaultArticleLanguage: event.target.value })}>{[["en", "languages.english"], ["es", "languages.spanish"], ["pt", "languages.portuguese"], ["ru", "languages.russian"], ["fr", "languages.french"], ["de", "languages.german"], ["it", "languages.italian"]].map(([value, label]) => <option key={value} value={value}>{intl.formatMessage({ id: label as "languages.english" | "languages.spanish" | "languages.portuguese" | "languages.russian" | "languages.french" | "languages.german" | "languages.italian" })}</option>)}</Select></SettingRow>
    </>;
}
