import { useEffect, useState } from "react";
import type { DesktopTelemetryClient, TelemetryConsent } from "@skladno/shared";
import { useIntl } from "react-intl";
import { SettingRow } from "./SettingRow.js";


export function TelemetrySettingsGroup({ client }: { client: DesktopTelemetryClient }) {
    const intl = useIntl();
    const [consent, setConsent] = useState<TelemetryConsent>();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        void client.getTelemetryConsent().then(setConsent).catch(() => setError(true));
    }, [client]);

    return <section className="mt-8 pt-8" aria-labelledby="settings-privacy-and-diagnostics">
        <h2 id="settings-privacy-and-diagnostics" className="text-base font-semibold">{intl.formatMessage({ id: "settings.privacyAndDiagnostics" })}</h2>
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.telemetry" })} hint={intl.formatMessage({ id: "settings.telemetryHint" })} status={error ? intl.formatMessage({ id: "settings.telemetrySaveFailed" }) : consent && !consent.supported ? intl.formatMessage({ id: "settings.telemetryUnavailable" }) : undefined}>
            <button type="button" role="switch" aria-checked={consent?.enabled ?? false} aria-label={intl.formatMessage({ id: "settings.telemetry" })} disabled={!consent || saving || (!consent.supported && !consent.enabled)} className="group inline-flex min-h-9 appearance-none items-center gap-2 border-0 bg-transparent px-0 py-1 text-xs font-semibold text-ink hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-55" onClick={() => {
                const enabled = !consent?.enabled;
                setSaving(true);
                setError(false);
                void client.setTelemetryConsent(enabled).then(setConsent).catch(() => setError(true)).finally(() => setSaving(false));
            }}>
                <span aria-hidden="true" className={`relative inline-flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors group-hover:border-brand ${consent?.enabled ? "border-brand bg-brand" : "border-border-strong bg-surface-raised"}`}><span className={`size-4 rounded-full border border-border-strong bg-surface transition-transform ${consent?.enabled ? "translate-x-4" : "translate-x-0"}`} /></span>
                <span>{consent?.enabled ? intl.formatMessage({ id: "settings.on" }) : intl.formatMessage({ id: "settings.off" })}</span>
            </button>
        </SettingRow>
        {consent?.installationId && <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.telemetryIdentifier" })} hint={intl.formatMessage({ id: "settings.telemetryIdentifierHint" })} status={copied ? intl.formatMessage({ id: "settings.telemetryIdentifierCopied" }) : undefined}>
            <div className="flex flex-wrap items-center gap-3">
                <code className="rounded bg-surface-raised px-2 py-1 text-xs text-ink">{consent.installationId}</code>
                <button type="button" className="min-h-9 rounded border border-border-strong px-3 text-xs font-semibold text-ink hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => void navigator.clipboard.writeText(consent.installationId!).then(() => setCopied(true)).catch(() => setCopied(false))}>{intl.formatMessage({ id: "settings.copyTelemetryIdentifier" })}</button>
            </div>
        </SettingRow>}
        <p className="mt-4 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.telemetryDisclosure" })} <a className="text-brand underline" href="https://github.com/kirillta/skladno/blob/main/docs/user/telemetry.md" target="_blank" rel="noreferrer">{intl.formatMessage({ id: "settings.telemetryDetails" })}</a></p>
    </section>;
}
