import type { CustomPublishLimitProfile } from "@skladno/shared";
import { FormattedMessage, useIntl } from "react-intl";
import { Button, Dialog } from "../../ui/primitives.js";


export function CustomProfileRemovalDialog({ profile, isDefault, close, remove }: { profile: CustomPublishLimitProfile; isDefault: boolean; close: () => void; remove: () => void }) {
    const intl = useIntl();

    return <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="remove-custom-profile-title" onCancel={(event) => {
        event.preventDefault();
        close();
    }}><h2 id="remove-custom-profile-title" className="text-lg font-semibold">{intl.formatMessage({ id: "settings.removeCustomProfileTitle" })}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
            <FormattedMessage id={isDefault ? "settings.removeCustomDefaultDescription" : "settings.removeCustomProfileDescription"} values={{ name: profile.name, profile: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong> }} />
        </p>
        <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={close}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            <Button variant="danger" onClick={remove}>{intl.formatMessage({ id: "settings.remove" })}</Button>
        </div>
    </Dialog>;
}
