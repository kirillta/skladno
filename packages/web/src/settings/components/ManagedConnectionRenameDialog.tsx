import { useIntl } from "react-intl";
import { Button, Dialog, Field } from "../../ui/primitives.js";


export function ManagedConnectionRenameDialog({ label, setLabel, close, save }: { label: string; setLabel: (value: string) => void; close: () => void; save: () => void }) {
    const intl = useIntl();

    return <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="rename-connection-title" onCancel={(event) => {
        event.preventDefault();
        close();
    }}><h2 id="rename-connection-title" className="text-lg font-semibold">{intl.formatMessage({ id: "settings.renameConnectionTitle" })}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "settings.renameConnectionHint" })}</p>
        <Field className="mt-4" aria-label={intl.formatMessage({ id: "settings.connectionName" })} autoFocus value={label} onChange={(event) => setLabel(event.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            <Button onClick={save}>{intl.formatMessage({ id: "settings.saveConnectionName" })}</Button>
        </div>
    </Dialog>;
}
