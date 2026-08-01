import type { ArticleRevision } from "@skladno/shared";
import { Badge, Button } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { formatDateTime } from "../../i18n/formatting.js";

export function RevisionHistoryView({ revisions, currentRevisionId, select }: {
    revisions: ArticleRevision[];
    currentRevisionId: string;
    select: (item: ArticleRevision) => void;
}) {
    const intl = useIntl();
    return <div>
        <h2 className="font-semibold">{intl.formatMessage({ id: "revisions.heading" })}</h2>
        <ol className="mt-4 space-y-2">
            {revisions.map((revision) => <li key={revision.id} className="flex items-center gap-3 rounded-control border border-border p-3">
                <Badge>{intl.formatMessage({ id: revision.id === currentRevisionId ? "revisions.current" : "revisions.revision" })}</Badge>
                <span className="text-xs text-muted">{formatDateTime(revision.createdAt, intl.locale)}</span>
                <Button className="ml-auto" variant="secondary" disabled={revision.id === currentRevisionId} onClick={() => select(revision)}>{intl.formatMessage({ id: "revisions.restore" })}</Button>
            </li>)}
        </ol>
    </div>;
}
