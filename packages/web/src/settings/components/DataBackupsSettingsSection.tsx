import type { BackupPolicy, EditorialWorkspaceClient } from "@skladno/shared";
import { useIntl } from "react-intl";
import { useEffect, useState } from "react";
import { Button, Select } from "../../ui/primitives.js";
import { SettingRow, SettingsGroup } from "./SettingRow.js";
import { chooseBackupFolder, saveWebBackup, selectedBackupFolderName } from "../web-backups.js";


export function DataBackupsSettingsSection({ client, backupPolicy, save }: { client: EditorialWorkspaceClient; backupPolicy: BackupPolicy; save: (next: BackupPolicy) => Promise<void> }) {
    const intl = useIntl();
    const desktop = window.skladnoDesktop;
    const [creating, setCreating] = useState(false);
    const [folderName, setFolderName] = useState<string>();
    const [folderStatus, setFolderStatus] = useState<string>();
    const [backupStatus, setBackupStatus] = useState<string>();

    useEffect(() => {
        if (desktop)
            void desktop.getLocations().then((locations) => setFolderName(locations.backupDirectory), () => undefined);
        else
            void selectedBackupFolderName().then(setFolderName, () => undefined);
    }, [desktop]);

    return <>
        <SettingsGroup label={intl.formatMessage({ id: "settings.backupStorage" })}>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.backupFolder" })} hint={intl.formatMessage({ id: "settings.backupFolderHint" })} status={folderStatus ?? (folderName ? intl.formatMessage({ id: "settings.backupFolderSelected" }, { folderName }) : undefined)}><div className="flex gap-2"><Button variant="secondary" onClick={() => void (desktop ? desktop.chooseBackupDirectory() : chooseBackupFolder()).then((name) => {
                setFolderName(name);
                setFolderStatus(intl.formatMessage({ id: "settings.backupFolderSelected" }, { folderName: name }));
            }, () => setFolderStatus(intl.formatMessage({ id: "settings.backupFolderFailed" })))}>{intl.formatMessage({ id: "settings.chooseBackupFolder" })}</Button>
            {desktop && folderName && <Button variant="quiet" onClick={() => void desktop.revealBackupDirectory()}>{intl.formatMessage({ id: "settings.revealBackupFolder" })}</Button>}</div>
            </SettingRow>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.createBackup" })} hint={intl.formatMessage({ id: "settings.createBackupHint" })} status={backupStatus ?? (creating ? intl.formatMessage({ id: "settings.backupCreating" }) : undefined)}>
                <Button disabled={!folderName} state={creating ? "loading" : "default"} onClick={() => {
                    setCreating(true);
                    void (desktop ? desktop.createNativeBackup().then((backup) => backup.path.split(/[\\/]/).at(-1) ?? backup.path) : saveWebBackup(client, "manual", backupPolicy)).then((name) => setBackupStatus(intl.formatMessage({ id: "settings.backupCreated" }, { name })), () => setBackupStatus(intl.formatMessage({ id: "settings.backupCreateFailed" }))).finally(() => setCreating(false));
                }}>{intl.formatMessage({ id: "settings.createBackup" })}</Button>
            </SettingRow>
        </SettingsGroup>
        <SettingsGroup label={intl.formatMessage({ id: "settings.backupAutomation" })}>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.automaticBackups" })} hint={intl.formatMessage({ id: "settings.automaticBackupsHint" })}>
                <button type="button" role="switch" aria-checked={backupPolicy.schedule === "daily"} aria-label={intl.formatMessage({ id: "settings.automaticBackups" })} className="group inline-flex min-h-9 appearance-none items-center gap-2 border-0 bg-transparent px-0 py-1 text-xs font-semibold text-ink hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => void save({ ...backupPolicy, schedule: backupPolicy.schedule === "daily" ? "off" : "daily" })}>
                    <span aria-hidden="true" className={`relative inline-flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors group-hover:border-brand ${backupPolicy.schedule === "daily" ? "border-brand bg-brand" : "border-border-strong bg-surface-raised"}`}>
                        <span className={`size-4 rounded-full border border-border-strong bg-surface transition-transform ${backupPolicy.schedule === "daily" ? "translate-x-4" : "translate-x-0"}`} />
                    </span>
                    <span>{intl.formatMessage({ id: backupPolicy.schedule === "daily" ? "settings.daily" : "settings.off" })}</span>
                </button>
            </SettingRow>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.retention" })} hint={intl.formatMessage({ id: "settings.retentionHint" })}>
                <Select value={backupPolicy.retention.mode === "unlimited" ? "unlimited" : String(backupPolicy.retention.count)} onChange={(event) => void save({ ...backupPolicy, retention: event.target.value === "unlimited" ? { mode: "unlimited" } : { mode: "count", count: Number(event.target.value) } })}>
                    <option value="7">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 7 })}</option>
                    <option value="30">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 30 })}</option>
                    <option value="90">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 90 })}</option>
                    <option value="unlimited">{intl.formatMessage({ id: "settings.keepAllBackups" })}</option>
                </Select>
            </SettingRow>
        </SettingsGroup>
    </>;
}
