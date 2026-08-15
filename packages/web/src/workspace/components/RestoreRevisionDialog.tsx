import { useState } from "react";
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
    const [pendingMode, setPendingMode] = useState<"keep" | "save" | "discard">();
    const startRestore = (mode: "keep" | "save" | "discard") => {
        setPendingMode(mode);
        void restore(mode).then(() => setPendingMode(undefined), () => setPendingMode(undefined));
    };
    if (!candidate)
        return null;

    return <Dialog open>
        <h2 className="font-semibold">{intl.formatMessage({ id: "views.restoreHeading" })}</h2>
        <p className="mt-2 text-sm">{intl.formatMessage({ id: "views.restoreDescription" })}</p>
        {hasUncommittedChanges && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.restoreDraftDescription" })}</p>}
        <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" disabled={Boolean(pendingMode)} onClick={close}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            {hasUncommittedChanges && <Button variant="secondary" state={pendingMode === "save" ? "loading" : "default"} disabled={Boolean(pendingMode)} onClick={() => startRestore("save")}>{intl.formatMessage({ id: "views.saveAndRestore" })}</Button>}
            <Button variant={hasUncommittedChanges ? "danger" : "primary"} state={pendingMode === (hasUncommittedChanges ? "discard" : "keep") ? "loading" : "default"} disabled={Boolean(pendingMode)} onClick={() => startRestore(hasUncommittedChanges ? "discard" : "keep")}>{intl.formatMessage({ id: hasUncommittedChanges ? "views.discardDraftAndRestore" : "views.restoreRevision" })}</Button>
        </div>
    </Dialog>;
}
