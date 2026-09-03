import { cleanup } from "@testing-library/react";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot } from "@skladno/shared";


export function settingsSnapshot(): ApplicationSettingsSnapshot {
    return {
        general: defaultGeneralSettings,
        connections: [],
        modelPreferences: { defaultModel: "", skillOverrides: {} },
        backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } },
        keyBindingOverrides: {},
    };
}


export function resetApplicationSettingsTestEnvironment() {
    cleanup();
    window.skladnoDesktop = undefined;
    window.skladnoUpdates = undefined;
}
