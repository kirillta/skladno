import { useIntl } from "react-intl";
import { Button } from "../../ui/primitives.js";
import { settingsSections, type SettingsSection } from "../settings-sections.js";


export function SettingsNavigation({ section, setSection, back, status }: { section: SettingsSection; setSection: (section: SettingsSection) => void; back: () => void; status: string }) {
    const intl = useIntl();

    return <aside className="hidden w-52 shrink-0 border-r border-border bg-surface-supporting md:flex md:flex-col" aria-label={intl.formatMessage({ id: "settings.navigation" })}>
        <header className="flex min-h-18 items-center border-b border-border px-3">
            <Button variant="quiet" onClick={back}>{intl.formatMessage({ id: "settings.backToWorkspace" })}</Button>
        </header>
        <nav className="p-2">
            {settingsSections.map((item) => <button key={item.id} className={`min-h-10 w-full rounded-control px-3 text-left text-sm ${section === item.id ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-surface"}`} onClick={() => setSection(item.id)}>{intl.formatMessage({ id: item.label })}</button>)}
        </nav>
        <footer className="mt-auto border-t border-border px-4 py-3 text-micro text-muted" role="status">
            <span aria-hidden="true">&#9679;</span> {status}
        </footer>
    </aside>;
}
