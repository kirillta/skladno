import { useEffect, useRef, useState } from "react";
import type { AssistantCheckpointDraftMode, AssistantCheckpointPreview } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Button, Dialog } from "../../../ui/primitives.js";
import { getProvenanceMessageId } from "../../views/revision-history-presentation.js";


export function AssistantCheckpointDialog({ preview, replacingComposer, close, restore }: {
    preview: AssistantCheckpointPreview;
    replacingComposer: boolean;
    close: () => void;
    restore: (mode?: AssistantCheckpointDraftMode) => Promise<unknown>;
}) {
    const intl = useIntl();
    const dialog = useRef<HTMLDialogElement>(null);
    const [pending, setPending] = useState<AssistantCheckpointDraftMode | "restore">();
    const start = (mode?: AssistantCheckpointDraftMode) => {
        setPending(mode ?? "restore");
        void restore(mode).then(() => setPending(undefined), () => setPending(undefined));
    };
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);
    const rejectedWork = [
        preview.counts.proposals > 0 ? intl.formatMessage({ id: "assistant.checkpoint.proposals" }, { count: preview.counts.proposals }) : undefined,
        preview.counts.findings > 0 ? intl.formatMessage({ id: "assistant.checkpoint.findings" }, { count: preview.counts.findings }) : undefined,
        preview.counts.translations > 0 ? intl.formatMessage({ id: "assistant.checkpoint.translations" }, { count: preview.counts.translations }) : undefined,
    ].filter((item) => item !== undefined);
    const revisionProvenance = preview.revision ? intl.formatMessage({ id: getProvenanceMessageId(preview.revision) }) : undefined;

    return <Dialog ref={dialog} aria-labelledby="assistant-checkpoint-title" onCancel={(event) => {
        event.preventDefault();
        close();
    }}>
        <h2 id="assistant-checkpoint-title" className="font-semibold">{intl.formatMessage({ id: "assistant.checkpoint.heading" })}</h2>
        {rejectedWork.length > 0 && <div className="mt-2 text-sm">
            <p>{intl.formatMessage({ id: "assistant.checkpoint.work" })}</p>
            <ul className="mt-1 list-disc pl-5">{rejectedWork.map((item) => <li key={item}>
                {item}
            </li>)}
            </ul>
        </div>}
        {preview.revision && <p className="mt-2 text-sm">{intl.formatMessage(
            { id: preview.revision.description ? "assistant.checkpoint.describedRevision" : "assistant.checkpoint.revision" },
            { number: preview.revision.number, description: preview.revision.description, provenance: revisionProvenance },
        )}</p>}
        {replacingComposer && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "assistant.checkpoint.replaceComposer" })}</p>}
        {preview.draftDecisionRequired && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "assistant.checkpoint.draft" })}</p>}
        <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" disabled={Boolean(pending)} onClick={close}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            {preview.draftDecisionRequired && <Button variant="danger" disabled={Boolean(pending)} state={pending === "discard" ? "loading" : "default"} onClick={() => start("discard")}>{intl.formatMessage({ id: "assistant.checkpoint.discard" })}</Button>}
            <Button variant="primary" disabled={Boolean(pending)} state={pending === (preview.draftDecisionRequired ? "preserve" : "restore") ? "loading" : "default"} onClick={() => start(preview.draftDecisionRequired ? "preserve" : undefined)}>
                {intl.formatMessage({ id: preview.draftDecisionRequired ? "assistant.checkpoint.save" : "assistant.checkpoint.restore" })}
            </Button>
        </div>
    </Dialog>;
}
