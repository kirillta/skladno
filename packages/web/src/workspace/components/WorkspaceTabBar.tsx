import type { KeyboardEvent } from "react";
import { Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { MessageId } from "../../i18n/messages.js";
import type { WorkspaceView } from "../EditorialWorkspace.js";

const views: { id: WorkspaceView; label: MessageId }[] = [
    { id: "write", label: "workspace.tabs.write" },
    { id: "proposal", label: "workspace.tabs.proposal" },
    { id: "revisions", label: "workspace.tabs.revisions" },
    { id: "fact-check", label: "workspace.tabs.factCheck" },
    { id: "style-profile", label: "workspace.tabs.styleProfile" },
    { id: "translations", label: "workspace.tabs.translations" },
    { id: "publish", label: "workspace.tabs.publish" },
];


export function WorkspaceTabBar({ view, setView }: {
    view: WorkspaceView;
    setView: (view: WorkspaceView) => void
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
        {views.map((item, index) => <Tab key={item.id}
            id={`workspace-tab-${item.id}`}
            aria-controls={`workspace-panel-${item.id}`}
            selected={view === item.id}
            tabIndex={view === item.id ? 0 : -1}
            onClick={() => setView(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}>{intl.formatMessage({ id: item.label })}</Tab>)}
    </TabList>;
}
