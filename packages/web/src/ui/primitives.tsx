import type { ButtonHTMLAttributes, DialogHTMLAttributes, HTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";


export type ControlState = "default" | "loading" | "success" | "warning" | "error" | "outdated" | "conflicted";
export type Tone = "info" | "success" | "warning" | "error";


function joinClassNames(...names: Array<string | undefined>): string {
    return names.filter(Boolean).join(" ");
}


const controlStateClasses: Record<ControlState, string> = {
    default: "",
    loading: "cursor-progress opacity-75",
    success: "border-success",
    warning: "border-warning",
    error: "border-danger",
    outdated: "border-warning border-dashed",
    conflicted: "border-danger border-double",
};


const buttonVariantClasses = {
    primary: "border-transparent bg-brand text-white hover:bg-brand-hover",
    secondary: "border-border bg-surface-raised text-brand hover:border-brand/45 hover:bg-brand-soft",
    quiet: "border-transparent bg-transparent text-muted hover:bg-brand-soft hover:text-brand",
    danger: "border-transparent bg-transparent text-danger hover:bg-danger-soft",
} as const;


export function Button({ children, className, variant = "primary", state = "default", ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger"; state?: ControlState }>) {
    return <button {...props} className={joinClassNames("min-h-9 rounded-control border px-3 py-2 text-xs font-semibold leading-5 transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55", buttonVariantClasses[variant], controlStateClasses[state], className)} aria-busy={state === "loading" || undefined}>{children}</button>;
}


export function IconButton({ label, children, className, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>) {
    return <button {...props} className={joinClassNames("inline-grid size-9 place-items-center rounded-control border border-transparent p-1 text-brand transition-colors hover:bg-brand-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55", className)} aria-label={label}>{children}</button>;
}


export function Field({ className, state = "default", ...props }: InputHTMLAttributes<HTMLInputElement> & { state?: ControlState }) {
    return <input {...props} className={joinClassNames("min-h-10 w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-sm leading-5 text-ink placeholder:text-ink/45", controlStateClasses[state], className)} />;
}


export function TextareaField({ className, state = "default", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { state?: ControlState }) {
    return <textarea {...props} className={joinClassNames("min-h-10 w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-sm leading-5 text-ink placeholder:text-ink/45", controlStateClasses[state], className)} />;
}


export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} className={joinClassNames("min-h-10 w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-sm leading-5 text-ink", className)} />;
}


export function Badge({ children, className, variant = "soft", compact = false, ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { variant?: "soft" | "solid"; compact?: boolean }>) {
    return (
        <span
            {...props}
            className={joinClassNames(
                "inline-flex items-center rounded-full font-semibold",
                variant === "solid" ? "bg-brand text-white" : "bg-brand-soft text-brand",
                compact ? "size-4 shrink-0 justify-center p-0 text-[0.625rem] leading-none" : "gap-1 px-2 py-0.5 text-xs leading-4",
                className,
            )}
        >
            {children}
        </span>
    );
}


export function Status({ label, children, tone = "info" }: PropsWithChildren<{ label: string; tone?: Tone }>) {
    const icon = tone === "error" || tone === "warning" ? "!" : tone === "success" ? "✓" : "i";
    const toneClasses = { info: "bg-info-soft text-info", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", error: "bg-danger-soft text-danger" };
    return <div className={joinClassNames("flex gap-2 rounded-panel border border-border p-3 text-xs leading-5", toneClasses[tone])}><span aria-hidden="true">{icon}</span><span><strong>{label}</strong>{children}</span></div>;
}


export function Banner({ children, tone = "info", className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement> & { tone?: Tone }>) {
    const toneClasses = { info: "bg-info-soft text-info", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", error: "bg-danger-soft text-danger" };
    return <div {...props} className={joinClassNames("flex gap-2 rounded-panel border border-border p-3 text-xs leading-5", toneClasses[tone], className)} role="status"><span aria-hidden="true">{tone === "error" || tone === "warning" ? "!" : tone === "success" ? "✓" : "i"}</span>{children}</div>;
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


export function Skeleton({ className, label = "Loading" }: { className?: string; label?: string }) {
    return <div className={joinClassNames("animate-pulse rounded-control bg-surface motion-reduce:animate-none", className)} role="status" aria-label={label} />;
}


export function EmptyState({ title, children }: PropsWithChildren<{ title: string }>) {
    return <div className="grid min-h-48 place-items-center gap-2 p-6 text-center text-muted"><strong>{title}</strong>{children}</div>;
}


export function Tooltip({ children, content }: { children: ReactNode; content: string }) {
    return <span className="group relative">{children}<span role="tooltip" className="pointer-events-none absolute z-10 w-max max-w-64 translate-y-1 rounded-control bg-ink p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{content}</span></span>;
}


export function Diff({ removed, added, layout = "stacked" }: { removed?: ReactNode; added?: ReactNode; layout?: "stacked" | "columns" }) {
    const removedContent = removed ?? <span className="italic text-muted">No original text</span>;
    const addedContent = added ?? <span className="italic text-muted">No proposed text</span>;

    if (layout === "columns")
        return (
            <div className="grid overflow-hidden rounded-panel border border-border md:grid-cols-2" aria-label="Proposed text change">
                <del className="block min-w-0 whitespace-pre-wrap border-b-4 border-danger bg-diff-removed p-4 decoration-danger md:border-b-0 md:border-r md:border-r-border md:border-l-4">
                    <strong className="mb-3 block font-ui text-[0.65rem] uppercase tracking-[0.08em] text-danger">Original</strong>
                    {removedContent}
                </del>
                <ins className="block min-w-0 whitespace-pre-wrap border-b-4 border-success bg-diff-added p-4 decoration-success md:border-b-0 md:border-l-4">
                    <strong className="mb-3 block font-ui text-[0.65rem] uppercase tracking-[0.08em] text-success">Proposed</strong>
                    {addedContent}
                </ins>
            </div>
        );

    return <div className="overflow-hidden rounded-panel border border-border" aria-label="Proposed text change">{removed && <del className="block whitespace-pre-wrap bg-[repeating-linear-gradient(-45deg,var(--color-diff-removed),var(--color-diff-removed)_6px,#fce9e6_6px,#fce9e6_12px)] p-2 decoration-danger"><strong>Removed: </strong>{removed}</del>}{added && <ins className="block whitespace-pre-wrap bg-[repeating-linear-gradient(-45deg,var(--color-diff-added),var(--color-diff-added)_6px,#e9f5ed_6px,#e9f5ed_12px)] p-2 decoration-success"><strong>Added: </strong>{added}</ins>}</div>;
}


export function Dialog({ children, ...props }: PropsWithChildren<DialogHTMLAttributes<HTMLDialogElement>>) {
    return <dialog {...props} className={joinClassNames("fixed inset-0 z-50 m-auto w-fit max-h-[calc(100dvh-2rem)] overflow-auto rounded-panel border border-border bg-surface-raised p-5 text-ink shadow-[0_0_0_100vmax_rgb(37_37_33_/_35%),0_1px_2px_rgb(37_37_33_/_8%),0_6px_18px_rgb(37_37_33_/_6%)]", props.className)}>{children}</dialog>;
}


export function Drawer({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
    return <aside {...props} className={joinClassNames("border border-border bg-surface-raised shadow-raised", props.className)}>{children}</aside>;
}
