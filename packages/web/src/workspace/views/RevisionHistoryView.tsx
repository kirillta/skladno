import { useEffect, useMemo, useState, type ComponentType } from "react";
import { defaultGeneralSettings, type ArticleRevision, type GeneralSettings } from "@skladno/shared";
import { Badge, Button, Select } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { formatDateTime } from "../../i18n/formatting.js";
import { RevisionArticlePreview } from "../editor/RevisionArticlePreview.js";
import { ArticleIcon, RevisionAiIcon, RevisionManualIcon, RevisionRestoreIcon } from "../../ui/icons.js";


function characterCount(content: string): number {
    return Array.from(content).length;
}


function provenanceMessageId(revision: ArticleRevision): "revisions.initial" | "revisions.author" | "revisions.acceptedProposal" | "revisions.restored" | "revisions.saved" {
    if (revision.restoredFromRevisionId || revision.provenance.kind === "restore")
        return "revisions.restored";

    if (revision.provenance.kind === "initial")
        return "revisions.initial";

    if (revision.provenance.kind === "author-draft")
        return "revisions.author";

    if (revision.provenance.kind === "accepted-proposal")
        return "revisions.acceptedProposal";

    return "revisions.saved";
}


type RevisionTimelineKind = "initial" | "manual" | "ai" | "restored";


function timelineKind(revision: ArticleRevision): RevisionTimelineKind {
    if (revision.restoredFromRevisionId || revision.provenance.kind === "restore")
        return "restored";

    if (revision.provenance.kind === "initial")
        return "initial";

    if (revision.provenance.kind === "accepted-proposal")
        return "ai";

    return "manual";
}


const timelineIcons: Record<RevisionTimelineKind, ComponentType<{ className?: string }>> = {
    initial: ArticleIcon,
    manual: RevisionManualIcon,
    ai: RevisionAiIcon,
    restored: RevisionRestoreIcon,
};

export function RevisionHistoryView({ revisions, currentRevisionId, select, generalSettings = defaultGeneralSettings }: {
    revisions: ArticleRevision[];
    currentRevisionId: string;
    select: (item: ArticleRevision) => void;
    generalSettings?: GeneralSettings;
}) {
    const intl = useIntl();
    const [selectedRevisionId, setSelectedRevisionId] = useState(currentRevisionId);
    const newestFirst = useMemo(() => [...revisions].reverse(), [revisions]);
    const selected = revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions.find((revision) => revision.id === currentRevisionId);

    useEffect(() => {
        setSelectedRevisionId(currentRevisionId);
    }, [currentRevisionId]);

    if (!selected)
        return null;

    const selectedIsCurrent = selected.id === currentRevisionId;
    const selectedProvenance = intl.formatMessage({ id: provenanceMessageId(selected) });
    const choose = (revision: ArticleRevision) => setSelectedRevisionId(revision.id);
    const formatRevisionDate = (createdAt: string) => formatDateTime(createdAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, "UTC");

    return <div className="flex min-h-0 flex-1 overflow-hidden rounded-panel border border-border bg-surface-raised">
        <nav className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex" aria-label={intl.formatMessage({ id: "revisions.historyNavigation" })}>
            <div className="border-b border-border px-4 py-4">
                <h2 className="text-base font-semibold">{intl.formatMessage({ id: "revisions.heading" })}</h2>
                <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "views.restoreDescription" })}</p>
            </div>
            <ol className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
                {newestFirst.map((revision) => {
                    const selectedItem = revision.id === selected.id;
                    const provenance = intl.formatMessage({ id: provenanceMessageId(revision) });
                    const kind = timelineKind(revision);
                    const TimelineIcon = timelineIcons[kind];

                    return <li key={revision.id} className="relative pl-10 after:absolute after:-bottom-7 after:left-4 after:top-7 after:w-px after:bg-border last:after:hidden">
                        <span className="absolute left-0 top-3 z-10 grid size-8 place-items-center rounded-full border border-border bg-surface-raised text-brand" data-revision-timeline-icon={kind}>
                            <TimelineIcon className={kind === "ai" || kind === "restored" ? "size-3" : "size-4"} />
                        </span>
                        <button className={`w-full rounded-control border p-3 text-left focus:outline-none ${selectedItem ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface"}`} type="button" aria-pressed={selectedItem} onClick={() => choose(revision)}>
                            <span className="block text-sm font-medium text-ink">{provenance}</span>
                            <span className="mt-1 block text-xs text-muted">{formatRevisionDate(revision.createdAt)} · {intl.formatMessage({ id: "revisions.characterCount" }, { count: intl.formatNumber(characterCount(revision.content)) })}</span>
                        </button>
                    </li>;
                })}
            </ol>
        </nav>
        <section className="flex min-w-0 flex-1 flex-col" aria-label={intl.formatMessage({ id: "revisions.articleContent" })}>
            <div className="border-b border-border px-5 py-4">
                <label className="block md:hidden">
                    <span className="text-xs font-semibold text-ink">{intl.formatMessage({ id: "revisions.select" })}</span>
                    <Select className="mt-1" value={selected.id} onChange={(event) => choose(revisions.find((revision) => revision.id === event.target.value)!)}>
                        {newestFirst.map((revision) => <option key={revision.id} value={revision.id}>{intl.formatMessage({ id: provenanceMessageId(revision) })} — {formatRevisionDate(revision.createdAt)}</option>)}
                    </Select>
                </label>
                <div className="mt-3 flex flex-wrap items-start gap-3 md:mt-0">
                    <div className="min-w-0 flex-1">
                        <p className="text-micro font-semibold uppercase tracking-overline text-muted">{selectedProvenance}</p>
                        <p className="mt-1 text-xs text-muted">{formatRevisionDate(selected.createdAt)} · {intl.formatMessage({ id: "revisions.characterCount" }, { count: intl.formatNumber(characterCount(selected.content)) })}</p>
                        {selected.restoredFromRevisionId && <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "revisions.restoredFromEarlier" })}</p>}
                        {selectedIsCurrent && <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "revisions.currentExplanation" })}</p>}
                    </div>
                    {selectedIsCurrent
                        ? <Badge>{intl.formatMessage({ id: "revisions.currentRevision" })}</Badge>
                        : <Button variant="secondary" onClick={() => select(selected)}>{intl.formatMessage({ id: "revisions.restore" })}</Button>}
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised px-8 py-7 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
                <article className="mx-auto w-full max-w-3xl"><RevisionArticlePreview revisionId={selected.id} content={selected.content} /></article>
            </div>
        </section>
    </div>;
}
