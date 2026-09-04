import type { ArticleRevision, GeneralSettings } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Badge, Button, Select } from "../../ui/primitives.js";
import { formatDateTime } from "../../i18n/formatting.js";
import { RevisionArticlePreview } from "../editor/RevisionArticlePreview.js";
import { characterCount, provenanceMessageId } from "./revision-history-presentation.js";


export function RevisionHistoryDetails({ revisions, selected, currentRevisionId, select, generalSettings }: {
    revisions: ArticleRevision[];
    selected: ArticleRevision;
    currentRevisionId: string;
    select: (revision: ArticleRevision) => void;
    generalSettings: GeneralSettings;
}) {
    const intl = useIntl();
    const newestFirst = [...revisions].reverse();
    const selectedIsCurrent = selected.id === currentRevisionId;
    const selectedProvenance = intl.formatMessage({ id: provenanceMessageId(selected) });
    const formatRevisionDate = (createdAt: string) => formatDateTime(createdAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, generalSettings.timeZone);

    return <section className="flex min-w-0 flex-1 flex-col" aria-label={intl.formatMessage({ id: "revisions.articleContent" })}>
        <div className="border-b border-border px-5 py-4">
            <label className="block md:hidden">
                <span className="text-xs font-semibold text-ink">{intl.formatMessage({ id: "revisions.select" })}</span>
                <Select className="mt-1" value={selected.id} onChange={(event) => select(revisions.find((revision) => revision.id === event.target.value)!)}>
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
        <div className="min-h-0 flex-1 overflow-y-auto bg-editor-surface px-8 py-7 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <article className="mx-auto w-full max-w-3xl"><RevisionArticlePreview revisionId={selected.id} content={selected.content} /></article>
        </div>
    </section>;
}
