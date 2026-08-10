import type { AppSetting } from "@skladno/shared";


export interface SettingsStore {
    get(key: string): AppSetting | undefined;
    set(key: string, value: unknown): AppSetting;
}
