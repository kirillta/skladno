import type { KeyboardEvent } from "react";
import type { KeyBindingOverrides } from "@skladno/shared";
import { Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import { workspaceViewDefinitions, type WorkspaceView } from "../workspace-views.js";

export interface WorkspaceTabBadgeDescriptor {
    label: string;
    accessibleLabel: string;
    tone: "default" | "warning" | "error";
    display?: "badge" | "dot";
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
            next = (index + 1) % workspaceViewDefinitions.length;
        else if (event.key === "ArrowLeft")
            next = (index + workspaceViewDefinitions.length - 1) % workspaceViewDefinitions.length;
        else if (event.key === "Home")
            next = 0;
        else if (event.key === "End")
            next = workspaceViewDefinitions.length - 1;
        else
            return;

        event.preventDefault();
        setView(workspaceViewDefinitions[next]!.id);
        tabs?.[next]?.focus();
    }

    return <TabList className="min-h-10 bg-surface px-3" aria-label={intl.formatMessage({ id: "workspace.tabs.ariaLabel" })}>
        {workspaceViewDefinitions.map((item, index) => {
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
                title={shortcutHint(accessibleName, item.command, shortcutOverrides)}
                onClick={() => setView(item.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}>{label}{badge && <span aria-hidden="true" className={badge.display === "dot" ? `ml-1.5 inline-block size-2 rounded-full ${badge.tone === "warning" ? "bg-warning" : badge.tone === "error" ? "bg-danger" : "bg-brand"}` : `ml-1.5 inline-flex rounded-control border px-1.5 py-0.5 text-micro font-semibold ${badgeClassName}`}>{badge.display === "dot" ? undefined : badge.label}</span>}</Tab>;
        })}
    </TabList>;
}
