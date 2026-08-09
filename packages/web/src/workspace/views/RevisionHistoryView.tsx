import { useEffect, useState } from "react";
import { defaultGeneralSettings, type ArticleRevision, type GeneralSettings } from "@skladno/shared";
import { RevisionHistoryDetails } from "./RevisionHistoryDetails.js";
import { RevisionHistoryNavigation } from "./RevisionHistoryNavigation.js";


export function RevisionHistoryView({ revisions, currentRevisionId, select, generalSettings = defaultGeneralSettings }: {
    revisions: ArticleRevision[];
    currentRevisionId: string;
    select: (item: ArticleRevision) => void;
    generalSettings?: GeneralSettings;
}) {
    const [selectedRevisionId, setSelectedRevisionId] = useState(currentRevisionId);
    const selected = revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions.find((revision) => revision.id === currentRevisionId);

    useEffect(() => {
        setSelectedRevisionId(currentRevisionId);
    }, [currentRevisionId]);

    if (!selected)
        return null;

    return <div className="flex min-h-0 flex-1 overflow-hidden rounded-panel border border-border bg-surface-raised">
        <RevisionHistoryNavigation revisions={revisions} selectedRevisionId={selected.id} onSelect={(revision) => setSelectedRevisionId(revision.id)} generalSettings={generalSettings} />
        <RevisionHistoryDetails revisions={revisions} selected={selected} currentRevisionId={currentRevisionId} select={select} generalSettings={generalSettings} />
    </div>;
}
