import {
    ApplicationClientError,
    applicationSettingsPath,
    backupsPath,
    type BackupPolicy,
    type GeneralSettings,
    HTTP_METHOD,
    restoreBackupPath,
    type ApplicationSettingsClient,
    type ApplicationSettingsSnapshot,
} from "@skladno/shared";
import { configureSystemDateTimeFormat } from "./i18n/formatting.js";


type SettingsTransportClient = Pick<
    ApplicationSettingsClient,
    "getApplicationSettings" | "updateGeneralSettings" | "updateBackupPolicy" | "createBackup" | "restoreBackup"
>;


export abstract class HttpSettingsClient implements SettingsTransportClient {
    constructor(protected readonly serviceUrl = "http://127.0.0.1:8787") { }


    protected abstract request<T>(path: string, init?: RequestInit): Promise<T>;


    async getApplicationSettings(): Promise<ApplicationSettingsSnapshot> {
        const settings = await this.request<ApplicationSettingsSnapshot>(applicationSettingsPath);
        configureSystemDateTimeFormat(settings.systemDateTimeFormat);

        return settings;
    }


    async updateGeneralSettings(input: GeneralSettings): Promise<GeneralSettings> {
        return this.request<GeneralSettings>(`${applicationSettingsPath}/general`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async updateBackupPolicy(input: BackupPolicy): Promise<BackupPolicy> {
        return this.request<BackupPolicy>(`${applicationSettingsPath}/backup-policy`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async createBackup(): Promise<Blob> {
        const response = await fetch(`${this.serviceUrl}${backupsPath}`, { method: HTTP_METHOD.POST });
        if (!response.ok)
            throw new ApplicationClientError("editorial_request_failed", { status: response.status }, response.status);

        return response.blob();
    }


    async restoreBackup(backup: Blob): Promise<void> {
        const response = await fetch(`${this.serviceUrl}${restoreBackupPath}`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/vnd.sqlite3" },
            body: backup,
        });
        if (!response.ok)
            throw new ApplicationClientError("editorial_request_failed", { status: response.status }, response.status);
    }
}
