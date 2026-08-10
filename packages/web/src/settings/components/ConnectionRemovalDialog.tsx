import type { OpenAiConnection } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Button, Dialog } from "../../ui/primitives.js";

export function ConnectionRemovalDialog({ connection, close, remove }: { connection: OpenAiConnection; close: () => void; remove: () => void }) {
    const intl = useIntl();

    return <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="remove-connection-title" onCancel={(event) => {
        event.preventDefault();
        close();
    }}><h2 id="remove-connection-title" className="text-lg font-semibold">{intl.formatMessage({ id: "settings.removeConnectionTitle" })}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "settings.removeConnectionDescription" }, { connectionName: connection.label })}</p>
        <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={close}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            <Button variant="danger" onClick={remove}>{intl.formatMessage({ id: "settings.removeConnection" })}</Button>
        </div>
    </Dialog>;
}
