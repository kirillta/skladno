import { type FactCheckClaimPreview } from "@skladno/shared";
import { useIntl } from "react-intl";
import { useState } from "react";
import { Icon } from "../../../ui/icons.js";


export function FactCheckClaims({ claims, className = "", embedded = false, onSelectionChange }: { claims: FactCheckClaimPreview[]; className?: string; embedded?: boolean; onSelectionChange?: (claim: string, selected: boolean) => Promise<void> }) {
    const intl = useIntl();
    const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
    const [changing, setChanging] = useState<ReadonlySet<string>>(new Set());
    const checked = claims.every((item) => item.checked && !skipped.has(item.claim));
    const selectedCount = claims.filter((item) => !skipped.has(item.claim)).length;
    const heading = intl.formatMessage({ id: checked ? "assistant.factCheckClaimsChecked" : "assistant.factCheckClaims" });
    const toggleClaim = (claim: string) => {
        const selected = skipped.has(claim);
        setSkipped((current) => updateSkipped(current, claim, !selected));
        setChanging((current) => new Set(current).add(claim));
        void onSelectionChange?.(claim, selected).catch(() => setSkipped((current) => updateSkipped(current, claim, selected))).finally(() => setChanging((current) => updateSkipped(current, claim, false)));
    };

    return <section className={`${embedded ? "" : "rounded-panel border border-border bg-surface-raised p-3"} ${className}`} aria-label={heading}>
        <p className="text-xs font-semibold text-muted">{heading}</p>
        {onSelectionChange && <p className="mt-1 text-xs leading-5 text-muted">{intl.formatMessage({ id: "assistant.claimSelectionHelp" })}</p>}
        <ul className="mt-1 space-y-1 text-xs leading-5 text-muted">{claims.map((item) => <li className="py-0.5" key={item.claim}>
            {onSelectionChange && (!item.checked || skipped.has(item.claim))
                ? <SelectableClaim item={item} skipped={skipped.has(item.claim)} disabled={changing.has(item.claim) || (!skipped.has(item.claim) && selectedCount === 1)} onChange={toggleClaim} />
                : <span className="flex gap-2">
                    <ClaimStatusIcon checked={item.checked} checking={item.checking} />
                    <span>{item.claim}</span>
                    <span className="sr-only">{intl.formatMessage({ id: claimStatusId(item) })}</span>
                </span>}
        </li>)}</ul>
    </section>;
}


function updateSkipped(current: ReadonlySet<string>, claim: string, skipped: boolean): Set<string> {
    const next = new Set(current);
    if (skipped)
        next.add(claim);
    else
        next.delete(claim);

    return next;
}


function SelectableClaim({ item, skipped, disabled, onChange }: { item: FactCheckClaimPreview; skipped: boolean; disabled: boolean; onChange: (claim: string) => void }) {
    const intl = useIntl();
    return <label className={`relative -mx-2 flex min-h-9 items-start gap-2 rounded-control px-2 ${disabled ? "cursor-default opacity-70" : "cursor-pointer text-ink hover:bg-brand-soft"}`}>
        <input type="checkbox" className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default" checked={!skipped} disabled={disabled} title={disabled && !skipped ? intl.formatMessage({ id: "assistant.keepOneClaim" }) : undefined} onChange={() => onChange(item.claim)} />
        <ClaimStatusIcon checked={!skipped && item.checked} checking={!skipped && item.checking} className="text-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand" />
        <span className={skipped ? "line-through" : ""}>{item.claim}</span>
    </label>;
}


function claimStatusId(item: FactCheckClaimPreview): "assistant.factCheckClaimChecked" | "assistant.factCheckClaimChecking" | "assistant.factCheckClaimPending" {
    if (item.checked)
        return "assistant.factCheckClaimChecked";

    return item.checking ? "assistant.factCheckClaimChecking" : "assistant.factCheckClaimPending";
}


function ClaimStatusIcon({ checked, checking, className = "text-muted" }: { checked?: boolean; checking?: boolean; className?: string }) {
    return <Icon className={`mt-1 size-3 shrink-0 ${className}`} strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        {checked ? <path d="m8 12 2.5 2.5L16 9" /> : checking ? <path d="M8 12h8" /> : null}
    </Icon>;
}
