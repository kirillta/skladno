import type { AppSetting } from "@skladno/shared";


export interface SettingsStore {
    getSetting(key: string): AppSetting | undefined;
    setSetting(key: string, value: unknown): AppSetting;
}
