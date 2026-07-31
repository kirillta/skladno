import type { ArticleRevision } from "@skladno/shared";
import { Button, Dialog } from "../../ui/primitives.js";
import { useIntl } from "react-intl";

export function RestoreRevisionDialog({ candidate, close, restore }: {
    candidate: ArticleRevision | undefined;
    close: () => void;
    restore: () => Promise<void>
}) {
    const intl = useIntl();
    if (!candidate)
        return null;

    return <Dialog open>
        <h2 className="font-semibold">{intl.formatMessage({ id: "views.restoreHeading" })}</h2>
        <p className="mt-2 text-sm">{intl.formatMessage({ id: "views.restoreDescription" })}</p>
        <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            <Button onClick={() => void restore()}>{intl.formatMessage({ id: "views.restoreRevision" })}</Button>
        </div>
    </Dialog>;
}
