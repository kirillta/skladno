import { forwardRef, type ButtonHTMLAttributes, type DialogHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type PropsWithChildren, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useIntl } from "react-intl";
import { ChevronDownIcon, StatusIcon } from "./icons.js";


export type ControlState = "default" | "loading" | "success" | "warning" | "error" | "outdated" | "conflicted";
export type Tone = "info" | "success" | "warning" | "error";


const toneClasses: Record<Tone, string> = {
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    error: "bg-danger-soft text-danger",
};


function joinClassNames(...names: (string | undefined)[]): string {
    return names.filter(Boolean).join(" ");
}


const controlStateClasses: Record<ControlState, string> = {
    default: "",
    loading: "relative cursor-progress opacity-75",
    success: "border-success",
    warning: "border-warning",
    error: "border-danger",
    outdated: "border-warning border-dashed",
    conflicted: "border-danger border-double",
};


const buttonVariantClasses = {
    primary: "border-transparent bg-brand text-on-brand hover:bg-brand-hover",
    secondary: "border-border bg-surface-raised text-brand hover:border-brand/45 hover:bg-brand-soft",
    quiet: "border-transparent bg-transparent text-muted hover:bg-brand-soft hover:text-brand",
    danger: "border-danger bg-danger text-on-brand hover:bg-danger/90",
} as const;


export function Button({ children, className, variant = "primary", state = "default", loadingLabel, disabled, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger"; state?: ControlState; loadingLabel?: string }>) {
    const intl = useIntl();
    const loading = state === "loading";
    return <button {...props} disabled={disabled || loading} className={joinClassNames("min-h-9 rounded-control border px-3 py-2 text-xs font-semibold leading-5 transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55", buttonVariantClasses[variant], controlStateClasses[state], className)} aria-busy={loading || undefined}>
        {loading ? <>
            <span className="invisible" aria-hidden="true">{children}</span>
            <svg className="absolute inset-0 m-auto size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" /><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" /></svg>
            <span className="sr-only" role="status">{loadingLabel ?? intl.formatMessage({ id: "ui.loading" })}</span>
        </> : children}
    </button>;
}


export function IconButton({ label, children, className, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>) {
    return <button {...props} className={joinClassNames("inline-grid size-9 place-items-center rounded-control border border-transparent p-1 text-brand transition-colors hover:bg-brand-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55", className)} aria-label={label}>{children}</button>;
}


export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { state?: ControlState }>(function Field({ className, state = "default", ...props }, ref) {
    return <input ref={ref} {...props} className={joinClassNames("min-h-10 w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-sm leading-5 text-ink placeholder:text-ink/45", controlStateClasses[state], className)} />;
});


export function TextareaField({ className, state = "default", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { state?: ControlState }) {
    return <textarea {...props} className={joinClassNames("min-h-10 w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-sm leading-5 text-ink placeholder:text-ink/45", controlStateClasses[state], className)} />;
}


export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return <span className={joinClassNames("relative block w-full", className)}>
        <select {...props} className={joinClassNames("min-h-10 w-full appearance-none rounded-control border border-border bg-surface-raised px-3 py-2 pr-10 text-sm leading-5 text-ink", className)} />
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </span>;
}


export function Badge({ children, className, variant = "soft", compact = false, tone, ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { variant?: "soft" | "solid"; compact?: boolean; tone?: Tone }>) {
    return (
        <span
            {...props}
            className={joinClassNames(
                "inline-flex items-center rounded-full font-semibold",
                variant === "solid" ? "bg-brand text-on-brand" : tone ? toneClasses[tone] : "bg-brand-soft text-brand",
                compact ? "size-4 shrink-0 justify-center p-0 text-badge" : "gap-1 px-2 py-0.5 text-xs leading-4",
                className,
            )}
        >
            {children}
        </span>
    );
}


export function Status({ label, children, className, compact = false, tone = "info" }: PropsWithChildren<{ label: string; className?: string; compact?: boolean; tone?: Tone }>) {
    return <div className={joinClassNames("flex gap-2 rounded-panel border border-border text-xs leading-5", compact ? "min-h-9 p-2" : "p-3", toneClasses[tone], className)} role="status"><StatusIcon tone={tone} className="mt-0.5 size-4 shrink-0" /><span><strong>{label}</strong>{children}</span></div>;
}


export function Banner({ children, tone = "info", className, role = "status", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement> & { tone?: Tone }>) {
    return <div {...props} className={joinClassNames("flex gap-2 rounded-panel border border-border p-3 text-xs leading-5", toneClasses[tone], className)} role={role}><StatusIcon tone={tone} className="mt-0.5 size-4 shrink-0" />{children}</div>;
}


export function TabList({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
    return <div {...props} className={joinClassNames("flex gap-2 overflow-x-auto border-b border-border", props.className)} role="tablist">{children}</div>;
}


export function Tab({ children, selected, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }>) {
    return <button {...props} className={joinClassNames("relative min-h-9 shrink-0 border-b-2 border-transparent px-2.5 py-2 text-xs text-muted hover:text-ink", selected ? "font-semibold text-brand after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:bg-brand" : undefined, props.className)} role="tab" aria-selected={selected}>{children}</button>;
}


export function Progress({ value, label }: { value?: number; label: string }) {
    const safeValue = Math.max(0, Math.min(value ?? 0, 100));
    return <div className="h-2 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><span className="block h-full bg-brand transition-[width]" style={{ width: `${safeValue}%` }} /></div>;
}


export function Skeleton({ className, label }: { className?: string; label?: string }) {
    const intl = useIntl();
    return <div className={joinClassNames("animate-pulse rounded-control bg-surface motion-reduce:animate-none", className)} role="status" aria-label={label ?? intl.formatMessage({ id: "ui.loading" })} />;
}


export function EmptyState({ title, children, className }: PropsWithChildren<{ title: string; className?: string }>) {
    return <div className={joinClassNames("grid min-h-48 place-content-center justify-items-center gap-1 p-6 text-center", className)}>
        <p className="text-base font-medium text-muted">{title}</p>
        <div className="flex flex-col items-center gap-3 text-sm text-muted">{children}</div>
    </div>;
}


export function Tooltip({ children, content }: { children: ReactNode; content: string }) {
    return <span className="group relative">{children}<span role="tooltip" className="pointer-events-none absolute z-10 w-max max-w-64 translate-y-1 rounded-control bg-ink p-2 text-xs text-on-brand opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{content}</span></span>;
}


export function Diff({ removed, added, layout = "stacked", state = "pending" }: { removed?: ReactNode; added?: ReactNode; layout?: "stacked" | "columns"; state?: "pending" | "accepted" | "rejected" }) {
    const intl = useIntl();
    const removedContent = removed ?? <span className="italic text-muted">{intl.formatMessage({ id: "ui.noOriginal" })}</span>;
    const addedContent = added ?? <span className="italic text-muted">{intl.formatMessage({ id: "ui.noProposed" })}</span>;

    if (layout === "columns")
        return (
            <div className="grid gap-3 rounded-panel border border-border bg-canvas p-3 md:grid-cols-2" aria-label={intl.formatMessage({ id: "ui.proposedChange" })}>
                <del className={joinClassNames("block min-w-0 whitespace-pre-wrap rounded-control border-l-4 border-danger bg-[repeating-linear-gradient(-45deg,var(--color-diff-removed),var(--color-diff-removed)_6px,var(--color-diff-removed-stripe)_6px,var(--color-diff-removed-stripe)_12px)] p-4 no-underline", state === "accepted" ? "opacity-55" : undefined)}>
                    <strong className="mb-3 block font-ui text-micro uppercase tracking-overline text-danger">{intl.formatMessage({ id: "ui.original" })}</strong>
                    {removedContent}
                </del>
                <ins className={joinClassNames("block min-w-0 whitespace-pre-wrap rounded-control border-l-4 border-success bg-[repeating-linear-gradient(-45deg,var(--color-diff-added),var(--color-diff-added)_6px,var(--color-diff-added-stripe)_6px,var(--color-diff-added-stripe)_12px)] p-4 no-underline", state === "rejected" ? "opacity-55" : undefined)}>
                    <strong className="mb-3 block font-ui text-micro uppercase tracking-overline text-success">{intl.formatMessage({ id: "ui.proposed" })}</strong>
                    {addedContent}
                </ins>
            </div>
        );

    return <div className="overflow-hidden rounded-panel border border-border" aria-label={intl.formatMessage({ id: "ui.proposedChange" })}>{removed && <del className="block whitespace-pre-wrap bg-[repeating-linear-gradient(-45deg,var(--color-diff-removed),var(--color-diff-removed)_6px,var(--color-diff-removed-stripe)_6px,var(--color-diff-removed-stripe)_12px)] p-2 no-underline"><strong>{intl.formatMessage({ id: "ui.removed" })}</strong>{removed}</del>}{added && <ins className="block whitespace-pre-wrap bg-[repeating-linear-gradient(-45deg,var(--color-diff-added),var(--color-diff-added)_6px,var(--color-diff-added-stripe)_6px,var(--color-diff-added-stripe)_12px)] p-2 no-underline"><strong>{intl.formatMessage({ id: "ui.added" })}</strong>{added}</ins>}</div>;
}


export function Dialog({ children, ...props }: PropsWithChildren<DialogHTMLAttributes<HTMLDialogElement>>) {
    return <dialog {...props} className={joinClassNames("fixed inset-0 z-50 m-auto w-fit max-h-[calc(100dvh-2rem)] overflow-auto rounded-panel border border-border bg-surface-raised p-5 text-ink shadow-dialog", props.className)}>{children}</dialog>;
}


export function Drawer({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
    return <aside {...props} className={joinClassNames("border border-border bg-surface-raised shadow-raised", props.className)}>{children}</aside>;
}
