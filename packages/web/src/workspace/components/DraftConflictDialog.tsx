import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import type { DraftConflict } from "../EditorialWorkspace.js";
import { Button, Diff } from "../../ui/primitives.js";


export function DraftConflictDialog({ conflict, open, close, resolve }: {
    conflict: DraftConflict | undefined;
    open: boolean;
    close: () => void;
    resolve: (mode: "keep" | "draft" | "revision") => Promise<void>;
}) {
    const intl = useIntl();
    const dialog = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const element = dialog.current;
        if (!element)
            return;

        if (open && !element.open)
            element.showModal();

        if (!open && element.open)
            element.close();
    }, [open]);

    if (!conflict)
        return null;

    function confirmAndResolve(mode: "draft" | "revision") {
        const messageId = mode === "draft" ? "draftConflict.confirmDraft" : "draftConflict.confirmRevision";
        if (window.confirm(intl.formatMessage({ id: messageId })))
            void resolve(mode);
    }

    const latestContent = conflict.draft?.content ?? conflict.article.currentRevision.content;
    return <dialog ref={dialog} className="fixed inset-0 z-50 m-auto max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-panel border border-border bg-surface-raised p-5 text-ink shadow-dialog sm:max-w-3xl" aria-labelledby="draft-conflict-title" onCancel={(event) => {
        event.preventDefault();
        close();
    }} onClose={close}>
        <h2 id="draft-conflict-title" className="text-lg font-semibold">{intl.formatMessage({ id: "draftConflict.heading" })}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "draftConflict.description" })}</p>
        <div className="mt-5">
            <Diff layout="columns" removed={conflict.localContent} added={latestContent} />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="quiet" onClick={close}>{intl.formatMessage({ id: "draftConflict.cancel" })}</Button>
            <Button variant="secondary" onClick={() => void resolve("keep")}>{intl.formatMessage({ id: "draftConflict.keepMine" })}</Button>
            {conflict.draft && <Button variant="secondary" onClick={() => confirmAndResolve("draft")}>{intl.formatMessage({ id: "draftConflict.useDraft" })}</Button>}
            <Button variant="danger" onClick={() => confirmAndResolve("revision")}>{intl.formatMessage({ id: "draftConflict.useRevision" })}</Button>
        </div>
    </dialog>;
}
