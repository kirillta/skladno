import type { AppSetting } from "@skladno/shared";


export interface SettingsStore {
    getSetting(key: string): AppSetting | undefined;
    saveSetting(key: string, value: unknown): AppSetting;
}
