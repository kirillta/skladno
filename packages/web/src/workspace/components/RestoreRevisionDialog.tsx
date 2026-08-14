import type { ArticleRevision } from "@skladno/shared";
import { Button, Dialog } from "../../ui/primitives.js";
import { useIntl } from "react-intl";


export function RestoreRevisionDialog({ candidate, hasUncommittedChanges, close, restore }: {
    candidate: ArticleRevision | undefined;
    hasUncommittedChanges: boolean;
    close: () => void;
    restore: (mode: "keep" | "save" | "discard") => Promise<void>
}) {
    const intl = useIntl();
    if (!candidate)
        return null;

    return <Dialog open>
        <h2 className="font-semibold">{intl.formatMessage({ id: "views.restoreHeading" })}</h2>
        <p className="mt-2 text-sm">{intl.formatMessage({ id: "views.restoreDescription" })}</p>
        {hasUncommittedChanges && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.restoreDraftDescription" })}</p>}
        <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            {hasUncommittedChanges && <Button variant="secondary" onClick={() => void restore("save")}>{intl.formatMessage({ id: "views.saveAndRestore" })}</Button>}
            <Button variant={hasUncommittedChanges ? "danger" : "primary"} onClick={() => void restore(hasUncommittedChanges ? "discard" : "keep")}>{intl.formatMessage({ id: hasUncommittedChanges ? "views.discardDraftAndRestore" : "views.restoreRevision" })}</Button>
        </div>
    </Dialog>;
}
