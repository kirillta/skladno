import { type FactCheckClaimPreview } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Icon } from "../../../ui/icons.js";


export function FactCheckClaims({ claims, className = "", embedded = false }: { claims: FactCheckClaimPreview[]; className?: string; embedded?: boolean }) {
    const intl = useIntl();
    const checked = claims.every((item) => item.checked);
    const heading = intl.formatMessage({ id: checked ? "assistant.factCheckClaimsChecked" : "assistant.factCheckClaims" });

    return <section className={`${embedded ? "" : "rounded-panel border border-border bg-surface-raised p-3"} ${className}`} aria-label={heading}>
        <p className="text-xs font-semibold text-ink">{heading}</p>
        <ul className="mt-2 space-y-2 text-sm text-ink">{claims.map((item) => <li className="flex gap-2 py-1.5" key={item.claim}>
            <Icon className={`mt-0.5 size-4 shrink-0 ${item.checked ? "text-brand" : "text-muted"}`} strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2" />
                {item.checked && <path d="m8 12 2.5 2.5L16 9" />}
            </Icon>
            <span>{item.claim}</span>
            <span className="sr-only">{intl.formatMessage({ id: item.checked ? "assistant.factCheckClaimChecked" : "assistant.factCheckClaimPending" })}</span>
        </li>)}</ul>
    </section>;
}
