import type { FocusEvent, PointerEvent } from "react";
import type { StoredNotification } from "./notifications.js";


interface NotificationViewportProps {
    notifications: StoredNotification[];
    label: string;
    dismissLabel: (title: string) => string;
    dismiss: (id: string) => void;
    pause: (id: string, reason: "pointer" | "focus") => void;
    resume: (id: string, reason: "pointer" | "focus") => void;
}


function StatusIcon({ tone }: { tone: StoredNotification["tone"] }) {
    if (tone === "success")
        return <svg aria-hidden="true" className="mt-0.5 size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>;

    if (tone === "info")
        return <svg aria-hidden="true" className="mt-0.5 size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></svg>;

    return <svg aria-hidden="true" className="mt-0.5 size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17h.01" /></svg>;
}


function CloseIcon() {
    return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}


function notificationClasses(tone: StoredNotification["tone"]): string {
    const tones = {
        info: "border-info bg-info-soft text-info",
        success: "border-success bg-success-soft text-success",
        warning: "border-warning bg-warning-soft text-warning",
        error: "border-danger bg-danger-soft text-danger",
    };

    return tones[tone];
}


export function NotificationViewport({ notifications, label, dismissLabel, dismiss, pause, resume }: NotificationViewportProps) {
    function resumeAfterFocus(notification: StoredNotification, event: FocusEvent<HTMLElement>) {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
            return;

        resume(notification.id, "focus");
    }


    function resumeAfterPointer(notification: StoredNotification, event: PointerEvent<HTMLElement>) {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
            return;

        resume(notification.id, "pointer");
    }


    return <section aria-label={label} className="pointer-events-none fixed inset-x-4 top-4 z-40 flex flex-col gap-3 sm:inset-x-auto sm:right-4 sm:w-96">
        {notifications.map((notification) => <article
            key={notification.id}
            className={`pointer-events-auto flex gap-3 rounded-panel border p-3 text-xs leading-5 shadow-raised transition duration-150 motion-reduce:transition-none ${notificationClasses(notification.tone)}`}
            role={notification.tone === "info" || notification.tone === "success" ? "status" : "alert"}
            onPointerEnter={() => pause(notification.id, "pointer")}
            onPointerLeave={(event) => resumeAfterPointer(notification, event)}
            onFocusCapture={() => pause(notification.id, "focus")}
            onBlurCapture={(event) => resumeAfterFocus(notification, event)}
        >
            <StatusIcon tone={notification.tone} />
            <div className="min-w-0 flex-1">
                <p className="font-semibold">{notification.title}</p>
                {notification.message && <p className="mt-1">{notification.message}</p>}
                {notification.action && <button className="mt-2 min-h-9 rounded-control border border-current px-3 py-1 text-xs font-semibold leading-5 hover:bg-surface-raised/45 active:translate-y-px" type="button" onClick={() => {
                    try {
                        notification.action?.onAction();
                    } catch {
                        // Action handlers must surface their own recoverable failures through the notification API.
                    } finally {
                        dismiss(notification.id);
                    }
                }}>{notification.action.label}</button>}
            </div>
            <button className="grid size-9 shrink-0 place-items-center rounded-control hover:bg-surface-raised/45 active:translate-y-px"
                type="button"
                aria-label={dismissLabel(notification.title)}
                onClick={() => dismiss(notification.id)}>
                <CloseIcon />
            </button>
        </article>)}
    </section>;
}
