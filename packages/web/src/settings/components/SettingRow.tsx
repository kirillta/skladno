import { cloneElement, isValidElement, useId, type ReactNode } from "react";


export function SettingRow({ label, hint, children, status, action, headingLevel = 2 }: { label: string; hint: string; children: ReactNode; status?: ReactNode; action?: ReactNode; headingLevel?: 2 | 3 }) {
    const hintId = useId();
    const Heading = headingLevel === 3 ? "h3" : "h2";

    return <section className="border-b border-border py-6 last:border-b-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] md:gap-x-12">
        <div>
            <Heading className="text-sm font-semibold">{label}</Heading>
            <p id={hintId} className="mt-1 text-sm leading-5 text-muted">{hint}</p>
        </div>
        <div className="mt-4 min-w-0 md:mt-0">
            <div className="max-w-md">{isValidElement(children) ? cloneElement(children, { "aria-describedby": hintId }) : children}</div>
            {action && <div className="mt-3">{action}</div>}
            {status && <p className="mt-2 text-xs text-muted" role="status">{status}</p>}
        </div>
    </section>;
}


export function SettingsGroup({ label, children, separated = false }: { label: string; children: ReactNode; separated?: boolean }) {
    const headingId = useId();

    return <section className={separated ? "mt-8 border-t border-border pt-8" : "mt-8"} aria-labelledby={headingId}>
        <h2 id={headingId} className="text-base font-semibold">{label}</h2>
        {children}
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
