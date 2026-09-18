import type { ApplicationSettingsSnapshot } from "@skladno/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { settingsSections, type SettingsSection } from "../settings-sections.js";


export function SettingsContent({ section, settings, children }: {
    section: SettingsSection;
    settings: ApplicationSettingsSnapshot | undefined;
    children: ReactNode;
}) {
    const intl = useIntl();

    return <section data-focus-area="settings-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
            <h1 className="text-2xl font-semibold">{intl.formatMessage({ id: settingsSections.find((item) => item.id === section)?.label ?? "settings.general" })}</h1>
            {settings ? children : null}
        </div>
    </section>;
}
