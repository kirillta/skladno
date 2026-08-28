import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import type { DesktopUpdateState } from "@skladno/shared";
import { getDesktopUpdateClient } from "../../desktop-client.js";
import { UpdateIcon } from "../../ui/icons.js";


export function UpdateController({ expanded = false }: { expanded?: boolean }) {
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
    return <button className={expanded ? `flex min-h-9 w-full items-center justify-start rounded-control px-3 text-left text-xs font-semibold transition-colors hover:bg-brand-soft ${warning || state.kind === "failed" ? "text-warning" : "text-brand"} focus:outline-none` : `ml-2 grid size-6 place-items-center border-l border-border ${warning || state.kind === "failed" ? "text-warning" : "text-brand"} focus:outline-none`} type="button" aria-label={label} title={label} aria-busy={state.kind === "downloading" || undefined} onClick={() => window.dispatchEvent(new Event("skladno:open-updates"))}>
        <UpdateIcon className={`size-3 ${state.kind === "downloading" ? "motion-safe:animate-pulse" : ""}`} />
        {expanded && <span className="ml-2">{intl.formatMessage({ id: "settings.updates" })}</span>}
    </button>;
}
