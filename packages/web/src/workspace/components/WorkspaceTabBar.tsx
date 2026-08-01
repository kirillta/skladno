import type { KeyboardEvent } from "react";
import { KEY_BINDING_COMMAND, type KeyBindingOverrides } from "@skladno/shared";
import { Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { MessageId } from "../../i18n/messages.js";
import type { WorkspaceView } from "../EditorialWorkspace.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";

const views: { id: WorkspaceView; label: MessageId }[] = [
    { id: "write", label: "workspace.tabs.write" },
    { id: "proposal", label: "workspace.tabs.proposal" },
    { id: "revisions", label: "workspace.tabs.revisions" },
    { id: "fact-check", label: "workspace.tabs.factCheck" },
    { id: "style-profile", label: "workspace.tabs.styleProfile" },
    { id: "translations", label: "workspace.tabs.translations" },
    { id: "publish", label: "workspace.tabs.publish" },
];

export interface WorkspaceTabBadgeDescriptor {
    label: string;
    accessibleLabel: string;
    tone: "default" | "warning" | "error";
}


export function WorkspaceTabBar({ view, setView, badges = {}, shortcutOverrides = {} }: {
    view: WorkspaceView;
    setView: (view: WorkspaceView) => void;
    badges?: Partial<Record<WorkspaceView, WorkspaceTabBadgeDescriptor>>;
    shortcutOverrides?: KeyBindingOverrides;
}) {
    const intl = useIntl();
    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]");
        let next: number;

        if (event.key === "ArrowRight")
            next = (index + 1) % views.length;
        else if (event.key === "ArrowLeft")
            next = (index + views.length - 1) % views.length;
        else if (event.key === "Home")
            next = 0;
        else if (event.key === "End")
            next = views.length - 1;
        else
            return;

        event.preventDefault();
        setView(views[next]!.id);
        tabs?.[next]?.focus();
    }

    return <TabList className="min-h-10 px-3" aria-label={intl.formatMessage({ id: "workspace.tabs.ariaLabel" })}>
        {views.map((item, index) => {
            const badge = badges[item.id];
            const label = intl.formatMessage({ id: item.label });
            const accessibleName = badge ? `${label}: ${badge.accessibleLabel}` : label;
            const badgeClassName = badge?.tone === "error"
                ? "border-danger bg-danger-soft text-danger"
                : badge?.tone === "warning"
                    ? "border-warning bg-warning-soft text-warning"
                    : "border-border-strong bg-surface text-ink";

            return <Tab key={item.id}
                id={`workspace-tab-${item.id}`}
                aria-controls={`workspace-panel-${item.id}`}
                aria-label={accessibleName}
                selected={view === item.id}
                tabIndex={view === item.id ? 0 : -1}
                title={shortcutHint(accessibleName, [KEY_BINDING_COMMAND.VIEW_WRITE, KEY_BINDING_COMMAND.VIEW_PROPOSAL, KEY_BINDING_COMMAND.VIEW_REVISIONS, KEY_BINDING_COMMAND.VIEW_FACT_CHECK, KEY_BINDING_COMMAND.VIEW_STYLE_PROFILE, KEY_BINDING_COMMAND.VIEW_TRANSLATIONS, KEY_BINDING_COMMAND.VIEW_PUBLISH][index]!, shortcutOverrides)}
                onClick={() => setView(item.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}>{label}{badge && <span aria-hidden="true" className={`ml-1.5 inline-flex rounded-control border px-1.5 py-0.5 text-micro font-semibold ${badgeClassName}`}>{badge.label}</span>}</Tab>;
        })}
    </TabList>;
}
