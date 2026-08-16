export type SettingsSection = "general" | "keyBindings" | "ai" | "publishing" | "backups";

export const settingsSections: { id: SettingsSection; label: "settings.general" | "settings.keyBindings" | "settings.ai" | "settings.publishing" | "settings.dataBackups" }[] = [
    { id: "general", label: "settings.general" },
    { id: "keyBindings", label: "settings.keyBindings" },
    { id: "ai", label: "settings.ai" },
    { id: "publishing", label: "settings.publishing" },
    { id: "backups", label: "settings.dataBackups" },
];
