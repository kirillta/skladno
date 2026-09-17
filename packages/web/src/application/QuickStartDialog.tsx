import { useIntl } from "react-intl";
import { Button, Dialog, IconButton } from "../ui/primitives.js";
import { CloseIcon } from "../ui/icons.js";


export function QuickStartDialog({ hasUsableAiConnection, close, openModelSettings }: { hasUsableAiConnection: boolean; close: () => void; openModelSettings: () => void }) {
    const intl = useIntl();
    const addModelKey = () => {
        close();
        openModelSettings();
    };

    return <Dialog open aria-labelledby="quick-start-title" className="w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl" onCancel={(event) => {
        event.preventDefault();
        close();
    }} onKeyDown={(event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    }}>
        <div className="flex items-start justify-between gap-4">
            <h1 id="quick-start-title" className="text-lg font-semibold">{intl.formatMessage({ id: "quickStart.title" })}</h1>
            <IconButton label={intl.formatMessage({ id: "quickStart.close" })} variant="quiet" onClick={close}><CloseIcon /></IconButton>
        </div>
        <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-5">
            <li>
                <strong>{intl.formatMessage({ id: "quickStart.write.title" })}</strong>
                <p className="mt-1 text-muted">{intl.formatMessage({ id: "quickStart.write.description" })}</p>
            </li>
            <li>
                <strong>{intl.formatMessage({ id: "quickStart.assistant.title" })}</strong>
                <p className="mt-1 text-muted">{intl.formatMessage({ id: "quickStart.assistant.description" })}</p>
            </li>
            <li>
                <strong>{intl.formatMessage({ id: "quickStart.modelKey.title" })}</strong>
                <p className="mt-1 text-muted">{intl.formatMessage({ id: "quickStart.modelKey.description" })}</p>
            </li>
        </ol>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={close}>{intl.formatMessage({ id: "quickStart.skip" })}</Button>
            {hasUsableAiConnection
                ? <Button autoFocus onClick={close}>{intl.formatMessage({ id: "quickStart.startWriting" })}</Button>
                : <Button autoFocus onClick={addModelKey}>{intl.formatMessage({ id: "quickStart.addModelKey" })}</Button>}
        </div>
    </Dialog>;
}
