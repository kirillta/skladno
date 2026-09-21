import { Button, Dialog } from "../../ui/primitives.js";
import { useIntl } from "react-intl";


interface TranslationRejectionDialogProps {
    rejectionLanguage?: string;
    rejectionComplete: boolean;
    rejectionConfirmationOpen: boolean;
    rejecting: boolean;
    setRejectConfirmationOpen: (open: boolean) => void;
    confirmRejection: () => void;
}


export function TranslationRejectionDialog({ rejectionLanguage, rejectionComplete, rejectionConfirmationOpen, rejecting, setRejectConfirmationOpen, confirmRejection }: TranslationRejectionDialogProps) {
    const intl = useIntl();

    if (!rejectionLanguage || !rejectionConfirmationOpen)
        return null;

    return <Dialog className={`w-full max-w-[calc(100vw-2rem)] transition-[opacity,transform] duration-200 motion-reduce:transition-none sm:max-w-3xl ${rejectionComplete ? "pointer-events-none scale-[0.98] opacity-0" : "scale-100 opacity-100"}`} open aria-labelledby="reject-translation-title" onCancel={(event) => {
        event.preventDefault();
        if (!rejecting && !rejectionComplete)
            setRejectConfirmationOpen(false);
    }}>
        <h2 id="reject-translation-title" className="text-lg font-semibold">{intl.formatMessage({ id: "views.rejectTranslationTitle" })}</h2>
        {rejectionComplete
            ? <p className="mt-2 text-sm leading-6 text-muted" role="status">{intl.formatMessage({ id: "assistant.status.rejected" })}</p>
            : <>
                <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "views.rejectTranslationDescription" }, { language: rejectionLanguage })}</p>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="secondary" disabled={rejecting} autoFocus onClick={() => setRejectConfirmationOpen(false)}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
                    <Button variant="danger" state={rejecting ? "loading" : "default"} onClick={confirmRejection}>{intl.formatMessage({ id: "views.confirmRejectTranslation" })}</Button>
                </div>
            </>}
    </Dialog>;
}
