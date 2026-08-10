import type { BackupPolicy } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Field, Select } from "../../ui/primitives.js";
import { SettingRow } from "./SettingRow.js";

export function DataBackupsSettingsSection({ backupPolicy, setBackupPolicy, save }: { backupPolicy: BackupPolicy; setBackupPolicy: (next: BackupPolicy) => void; save: (next: BackupPolicy) => Promise<void> }) {
    const intl = useIntl();

    return <>
        <SettingRow label={intl.formatMessage({ id: "settings.activeDataLocation" })} hint={intl.formatMessage({ id: "settings.activeDataHint" })}><Field value={intl.formatMessage({ id: "settings.localDataDirectory" })} readOnly /></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.backupDestination" })} hint={intl.formatMessage({ id: "settings.backupDestinationHint" })}><Field value={backupPolicy.destinationPath ?? ""} placeholder={intl.formatMessage({ id: "settings.backupPlaceholder" })} onChange={(event) => setBackupPolicy({ ...backupPolicy, destinationPath: event.target.value })} onBlur={() => void save(backupPolicy)} /></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.automaticBackups" })} hint={intl.formatMessage({ id: "settings.automaticBackupsHint" })}><Select value={backupPolicy.schedule} onChange={(event) => void save({ ...backupPolicy, schedule: event.target.value as BackupPolicy["schedule"] })}><option value="off">{intl.formatMessage({ id: "settings.off" })}</option><option value="daily">{intl.formatMessage({ id: "settings.daily" })}</option></Select></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.retention" })} hint={intl.formatMessage({ id: "settings.retentionHint" })}><Select value={backupPolicy.retention.mode === "unlimited" ? "unlimited" : String(backupPolicy.retention.count)} onChange={(event) => void save({ ...backupPolicy, retention: event.target.value === "unlimited" ? { mode: "unlimited" } : { mode: "count", count: Number(event.target.value) } })}><option value="7">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 7 })}</option><option value="30">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 30 })}</option><option value="90">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 90 })}</option><option value="unlimited">{intl.formatMessage({ id: "settings.keepAllBackups" })}</option></Select></SettingRow>
    </>;
}
