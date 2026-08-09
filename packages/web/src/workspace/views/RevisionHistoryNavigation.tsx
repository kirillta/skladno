import type { ArticleRevision, GeneralSettings } from "@skladno/shared";
import { useIntl } from "react-intl";
import { formatDateTime } from "../../i18n/formatting.js";
import { characterCount, provenanceMessageId, timelineIcons, timelineKind } from "./revision-history-presentation.js";


export function RevisionHistoryNavigation({ revisions, selectedRevisionId, onSelect, generalSettings }: {
    revisions: ArticleRevision[];
    selectedRevisionId: string;
    onSelect: (revision: ArticleRevision) => void;
    generalSettings: GeneralSettings;
}) {
    const intl = useIntl();
    const newestFirst = [...revisions].reverse();
    const formatRevisionDate = (createdAt: string) => formatDateTime(createdAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, generalSettings.timeZone);

    return <nav className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex" aria-label={intl.formatMessage({ id: "revisions.historyNavigation" })}>
        <div className="border-b border-border px-4 py-4">
            <h2 className="text-base font-semibold">{intl.formatMessage({ id: "revisions.heading" })}</h2>
            <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "views.restoreDescription" })}</p>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            {newestFirst.map((revision) => {
                const selected = revision.id === selectedRevisionId;
                const provenance = intl.formatMessage({ id: provenanceMessageId(revision) });
                const kind = timelineKind(revision);
                const TimelineIcon = timelineIcons[kind];

                return <li key={revision.id} className="relative pl-10 after:absolute after:-bottom-7 after:left-4 after:top-7 after:w-px after:bg-border last:after:hidden">
                    <span className="absolute left-0 top-3 z-10 grid size-8 place-items-center rounded-full border border-border bg-surface-raised text-brand" data-revision-timeline-icon={kind}>
                        <TimelineIcon className={kind === "ai" || kind === "restored" ? "size-3" : "size-4"} />
                    </span>
                    <button className={`w-full rounded-control border p-3 text-left focus:outline-none ${selected ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface"}`} type="button" aria-pressed={selected} onClick={() => onSelect(revision)}>
                        <span className="block text-sm font-medium text-ink">{provenance}</span>
                        <span className="mt-1 block text-xs text-muted">{formatRevisionDate(revision.createdAt)} · {intl.formatMessage({ id: "revisions.characterCount" }, { count: intl.formatNumber(characterCount(revision.content)) })}</span>
                    </button>
                </li>;
            })}
        </ol>
    </nav>;
}
