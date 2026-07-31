import type { ArticleRevision } from "@skladno/shared";
import { Badge, Banner, Button } from "../../ui/primitives.js";

export function RevisionHistoryView({ revisions, currentRevisionId, select, message }: {
    revisions: ArticleRevision[];
    currentRevisionId: string;
    select: (item: ArticleRevision) => void;
    message: string
}) {
    return <div>
        <h2 className="font-semibold">Revision History</h2>
        {message && <Banner className="mt-3" tone="error" role="alert">{message}</Banner>}
        <ol className="mt-4 space-y-2">
            {revisions.map((revision) => <li key={revision.id} className="flex items-center gap-3 rounded-control border border-border p-3">
                <Badge>{revision.id === currentRevisionId ? "Current" : "Revision"}</Badge>
                <span className="text-xs text-muted">{new Date(revision.createdAt).toLocaleString()}</span>
                <Button className="ml-auto" variant="secondary" disabled={revision.id === currentRevisionId} onClick={() => select(revision)}>Restore this revision</Button>
            </li>)}
        </ol>
    </div>;
}
