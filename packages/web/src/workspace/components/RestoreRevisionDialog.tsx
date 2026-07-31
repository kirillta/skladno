import type { ArticleRevision } from "@skladno/shared";
import { Button, Dialog } from "../../ui/primitives.js";

export function RestoreRevisionDialog({ candidate, close, restore }: {
    candidate: ArticleRevision | undefined;
    close: () => void;
    restore: () => Promise<void>
}) {
    if (!candidate)
        return null;

    return <Dialog open>
        <h2 className="font-semibold">Restore Revision?</h2>
        <p className="mt-2 text-sm">Restoring creates a new immutable Revision; it does not rewrite history.</p>
        <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={() => void restore()}>Restore Revision</Button>
        </div>
    </Dialog>;
}
