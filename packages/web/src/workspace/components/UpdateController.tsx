import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import type { DesktopUpdateState } from "@skladno/shared";
import { getDesktopUpdateClient } from "../../desktop-client.js";
import { UpdateIcon } from "../../ui/icons.js";


export function UpdateController() {
    const intl = useIntl();
    const client = getDesktopUpdateClient();
    const [state, setState] = useState<DesktopUpdateState>();

    useEffect(() => {
        if (!client)
            return;

        void client.getState().then(setState).catch(() => undefined);
        return client.subscribe(setState);
    }, [client]);

    if (!state || state.kind === "unsupported" || state.kind === "current" || state.kind === "checking")
        return null;

    const label = state.kind === "failed" ? intl.formatMessage({ id: "status.updateFailed" }) : state.kind === "ready" ? intl.formatMessage({ id: "status.updateReady" }) : state.kind === "downloading" ? intl.formatMessage({ id: "status.updateDownloading" }) : intl.formatMessage({ id: "status.updateAvailable" }, { version: state.version });
    const warning = state.kind !== "failed" && state.security;
    return <button className={`ml-2 inline-grid size-6 place-items-center border-l border-border pl-2 ${warning || state.kind === "failed" ? "text-warning" : "text-brand"} focus:outline-none`} type="button" aria-label={label} title={label} aria-busy={state.kind === "downloading" || undefined} onClick={() => window.dispatchEvent(new Event("skladno:open-updates"))}>
        <UpdateIcon className={`size-3 ${state.kind === "downloading" ? "motion-safe:animate-pulse" : ""}`} />
    </button>;
}
