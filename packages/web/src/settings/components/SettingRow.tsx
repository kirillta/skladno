import { cloneElement, isValidElement, useId, type ReactNode } from "react";

export function SettingRow({ label, hint, children, status, action }: { label: string; hint: string; children: ReactNode; status?: ReactNode; action?: ReactNode }) {
    const hintId = useId();

    return <section className="border-b border-border py-5 last:border-b-0">
        <h2 className="text-sm font-semibold">{label}</h2>
        <p id={hintId} className="mt-1 text-sm leading-5 text-muted">{hint}</p>
        <div className="mt-3 max-w-md">{isValidElement(children) ? cloneElement(children, { "aria-describedby": hintId }) : children}</div>
        {action && <div className="mt-3">{action}</div>}
        {status && <p className="mt-2 text-xs text-muted" role="status">{status}</p>}
    </section>;
}


export function Control({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
    const hintId = useId();

    return <div>
        <p className="text-sm font-medium">{label}</p>
        <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>
        <div className="mt-2" aria-describedby={hintId}>{children}</div>
    </div>;
}
