import { useEffect, useState } from "react";
import { useIntl, type IntlShape } from "react-intl";
import type { DesktopUpdateClient, DesktopUpdateState } from "@skladno/shared";
import { Button, Dialog } from "../../ui/primitives.js";
import { SettingRow, SettingsGroup } from "./SettingRow.js";


function isUpdateDetails(state: DesktopUpdateState): state is Extract<DesktopUpdateState, { kind: "available" | "downloading" | "ready" }> {
    return state.kind === "available" || state.kind === "downloading" || state.kind === "ready";
}


function getUpdateStatus(state: DesktopUpdateState, intl: IntlShape): string {
    if (state.kind === "unsupported")
        return intl.formatMessage({ id: "settings.updatesUnavailable" });

    if (!state.networkAccess)
        return intl.formatMessage({ id: "settings.updatesNetworkAccessRequired" });

    if (state.kind === "checking")
        return intl.formatMessage({ id: "settings.updatesChecking" });

    if (state.kind === "failed")
        return intl.formatMessage({ id: `settings.updatesError.${state.error}` });

    if (state.kind === "downloading")
        return intl.formatMessage({ id: "status.updateDownloading" });

    if (isUpdateDetails(state))
        return intl.formatMessage({ id: "settings.updatesAvailable" }, { version: state.version });

    return intl.formatMessage({ id: "settings.updatesCurrent" });
}


function UpdateSwitch({ label, checked, onClick, intl }: { label: string; checked: boolean; onClick: () => void; intl: IntlShape }) {
    return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="group inline-flex min-h-9 appearance-none items-center gap-2 border-0 bg-transparent px-0 py-1 text-xs font-semibold text-ink hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={onClick}>
        <span aria-hidden="true" className={`relative inline-flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors group-hover:border-brand ${checked ? "border-brand bg-brand" : "border-border-strong bg-surface-raised"}`}>
            <span className={`size-4 rounded-full border border-border-strong bg-surface transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
        </span>
        <span>{intl.formatMessage({ id: checked ? "settings.on" : "settings.off" })}</span>
    </button>;
}


function NetworkSettings({ client, state, intl, onRequestPermission, onState }: { client: DesktopUpdateClient; state: DesktopUpdateState; intl: IntlShape; onRequestPermission: () => void; onState: (state: DesktopUpdateState) => void }) {
    return <>
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.updateNetworkAccess" })} hint={intl.formatMessage({ id: "settings.updateNetworkAccessHint" })}>
            <UpdateSwitch
                label={intl.formatMessage({ id: "settings.updateNetworkAccess" })}
                checked={state.networkAccess}
                intl={intl}
                onClick={() => state.networkAccess ? void client.setNetworkAccess(false).then(onState) : onRequestPermission()}
            />
        </SettingRow>
        {state.networkAccess && <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.automaticUpdates" })} hint={intl.formatMessage({ id: "settings.automaticUpdatesHint" })}>
            <UpdateSwitch label={intl.formatMessage({ id: "settings.automaticUpdates" })} checked={state.automaticChecks} intl={intl} onClick={() => void client.setAutomaticChecks(!state.automaticChecks).then(onState)} />
        </SettingRow>}
        {state.networkAccess && <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.includePrereleaseUpdates" })} hint={intl.formatMessage({ id: "settings.includePrereleaseUpdatesHint" })}>
            <UpdateSwitch label={intl.formatMessage({ id: "settings.includePrereleaseUpdates" })} checked={state.includePrereleases} intl={intl} onClick={() => void client.setIncludePrereleases(!state.includePrereleases).then(onState)} />
        </SettingRow>}
    </>;
}


function UpdateActions({ client, state, status, details, onState, intl }: { client: DesktopUpdateClient; state: DesktopUpdateState; status: string; details: boolean; onState: (state: DesktopUpdateState) => void; intl: IntlShape }) {
    const canCheckNow = state.kind !== "unsupported" && state.networkAccess && state.kind !== "failed" && state.kind !== "downloading";

    return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {state.kind === "available" && state.downloadable && <Button onClick={() => void client.download().then(onState)}>{intl.formatMessage({ id: "settings.downloadUpdate" })}</Button>}
        {state.kind === "downloading" && <Button state="loading" loadingLabel={status}>{status}</Button>}
        {state.kind === "ready" && <Button onClick={() => void client.restartAndUpdate()}>{intl.formatMessage({ id: "settings.restartAndUpdate" })}</Button>}
        {state.kind === "failed" && <Button variant="secondary" onClick={() => void client.checkNow().then(onState)}>{intl.formatMessage({ id: "settings.retry" })}</Button>}
        {canCheckNow && <Button variant="secondary" state={state.kind === "checking" ? "loading" : "default"} onClick={() => void client.checkNow().then(onState)}>{intl.formatMessage({ id: "settings.checkNow" })}</Button>}
        {details && <Button variant="quiet" onClick={() => void client.openReleaseNotes()}>{intl.formatMessage({ id: "settings.viewReleaseNotes" })}</Button>}
        {state.recoveryAvailable && <Button variant="quiet" onClick={() => void client.openRecoveryGuide()}>{intl.formatMessage({ id: "settings.updateRecovery" })}</Button>}
    </div>;
}


function NetworkPermissionDialog({ client, open, onClose, onState, intl }: { client: DesktopUpdateClient; open: boolean; onClose: () => void; onState: (state: DesktopUpdateState) => void; intl: IntlShape }) {
    if (!open)
        return null;

    return <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl" open aria-labelledby="update-network-permission-title" onCancel={(event) => {
        event.preventDefault();
        onClose();
    }}>
        <h2 id="update-network-permission-title" className="text-lg font-semibold">{intl.formatMessage({ id: "settings.updateNetworkPermissionTitle" })}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "settings.updateNetworkPermissionDescription" })}</p>
        <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={onClose}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
            <Button onClick={() => void client.setNetworkAccess(true).then((state) => {
                onState(state);
                onClose();
            })}>{intl.formatMessage({ id: "settings.allowNetworkAccess" })}</Button>
        </div>
    </Dialog>;
}


function UnavailableUpdates({ intl }: { intl: IntlShape }) {
    return <SettingsGroup label={intl.formatMessage({ id: "settings.updates" })}>
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.updateStatus" })} hint={intl.formatMessage({ id: "settings.updateStatusUnavailableHint" })} status={intl.formatMessage({ id: "settings.updatesUnavailable" })}><span /></SettingRow>
    </SettingsGroup>;
}


export function UpdatesSettingsGroup({ client, desktop }: { client: DesktopUpdateClient | undefined; desktop: boolean }) {
    const intl = useIntl();
    const [state, setState] = useState<DesktopUpdateState>();
    const [networkPermissionOpen, setNetworkPermissionOpen] = useState(false);

    useEffect(() => {
        if (!client)
            return;

        void client.getState().then(setState).catch(() => undefined);
        return client.subscribe(setState);
    }, [client]);

    if (!desktop || !client)
        return desktop ? <UnavailableUpdates intl={intl} /> : null;

    if (!state)
        return null;

    const status = getUpdateStatus(state, intl);

    return <SettingsGroup label={intl.formatMessage({ id: "settings.updates" })}>
        <NetworkSettings client={client} state={state} intl={intl} onRequestPermission={() => setNetworkPermissionOpen(true)} onState={setState} />
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.updateStatus" })} hint={intl.formatMessage({ id: "settings.updateStatusHint" }, { version: state.currentVersion })} status={status} fullWidthAction action={<UpdateActions client={client} state={state} status={status} details={isUpdateDetails(state)} onState={setState} intl={intl} />}>
            <span />
        </SettingRow>
        <NetworkPermissionDialog client={client} open={networkPermissionOpen} onClose={() => setNetworkPermissionOpen(false)} onState={setState} intl={intl} />
    </SettingsGroup>;
}
