import type { KeyboardEvent } from "react";
import { Tab, TabList } from "../../ui/primitives.js";
import type { WorkspaceView } from "../EditorialWorkspace.js";

const views: Array<{ id: WorkspaceView; label: string }> = [
    { id: "write", label: "Write" },
    { id: "proposal", label: "Proposal Review" },
    { id: "revisions", label: "Revisions" },
    { id: "fact-check", label: "Fact Check" },
    { id: "style-profile", label: "Style Profile" },
    { id: "translations", label: "Translations" },
    { id: "publish", label: "Publish" },
];


export function WorkspaceTabBar({ view, setView }: { 
    view: WorkspaceView; 
    setView: (view: WorkspaceView) => void 
}) {
    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]");
        let next = index;

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

    return <TabList aria-label="Article workspace views">
        {views.map((item, index) => <Tab key={item.id}
            id={`workspace-tab-${item.id}`}
            aria-controls={`workspace-panel-${item.id}`}
            selected={view === item.id}
            tabIndex={view === item.id ? 0 : -1}
            onClick={() => setView(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}>{item.label}</Tab>)}
    </TabList>;
}
