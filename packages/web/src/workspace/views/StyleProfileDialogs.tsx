import type { ArticleRevision } from "@skladno/shared";
import { Button, Dialog, Select } from "../../ui/primitives.js";
import { useIntl } from "react-intl";


export function StyleProfileDialogs({ removingId, snapshotRevisionId, revisions, onCloseRemove, onConfirmRemove, onCloseSnapshot, onSelectSnapshot, onConfirmSnapshot }: {
    removingId: string | undefined;
    snapshotRevisionId: string | undefined;
    revisions: readonly { revision: ArticleRevision; number: number }[];
    onCloseRemove: () => void;
    onConfirmRemove: () => void;
    onCloseSnapshot: () => void;
    onSelectSnapshot: (revisionId: string) => void;
    onConfirmSnapshot: () => void;
}) {
    const intl = useIntl();

    return <>{removingId && <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="remove-style-sample-title" onCancel={(event) => {
        event.preventDefault();
        onCloseRemove();
    }}>
        <h2 id="remove-style-sample-title" className="text-lg font-semibold">{intl.formatMessage({ id: "styleProfile.removeConfirmationTitle" })}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "styleProfile.removeConfirmationDescription" })}</p>
        <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" autoFocus onClick={onCloseRemove}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            <Button variant="danger" onClick={onConfirmRemove}>{intl.formatMessage({ id: "styleProfile.confirmRemove" })}</Button>
        </div>
    </Dialog>}
    {snapshotRevisionId && <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="add-style-revision-title" onCancel={(event) => {
        event.preventDefault();
        onCloseSnapshot();
    }}>
        <h2 id="add-style-revision-title" className="text-lg font-semibold">{intl.formatMessage({ id: "styleProfile.addRevisionTitle" })}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "styleProfile.addRevisionDescription" })}</p>
        <label className="mt-4 block text-sm font-medium" htmlFor="style-profile-revision">{intl.formatMessage({ id: "styleProfile.savedRevision" })}</label>
        <Select id="style-profile-revision" className="mt-1" value={snapshotRevisionId} onChange={(event) => onSelectSnapshot(event.target.value)}>
            {revisions.map(({ revision, number }) => <option key={revision.id} value={revision.id}>{intl.formatMessage({ id: "styleProfile.revision" }, { number })}</option>)}
        </Select>
        <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" autoFocus onClick={onCloseSnapshot}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            <Button onClick={onConfirmSnapshot}>{intl.formatMessage({ id: "styleProfile.confirmAddRevision" })}</Button>
        </div>
    </Dialog>}</>;
}
