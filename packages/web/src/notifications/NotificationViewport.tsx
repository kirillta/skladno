import type { FocusEvent, PointerEvent } from "react";
import { CloseIcon, StatusIcon } from "../ui/icons.js";
import { notificationClasses } from "../ui/primitives.js";
import type { StoredNotification } from "./notifications.js";


interface NotificationViewportProps {
    notifications: StoredNotification[];
    label: string;
    dismissLabel: (title: string) => string;
    dismiss: (id: string) => void;
    pause: (id: string, reason: "pointer" | "focus") => void;
    resume: (id: string, reason: "pointer" | "focus") => void;
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
            className={`pointer-events-auto relative flex gap-3 rounded-panel border p-3 text-xs leading-5 shadow-raised transition duration-150 motion-safe:animate-[notification-enter_180ms_ease-out] motion-reduce:transition-none ${notificationClasses(notification.tone)}`}
            role={notification.tone === "info" || notification.tone === "success" ? "status" : "alert"}
            onPointerEnter={() => pause(notification.id, "pointer")}
            onPointerLeave={(event) => resumeAfterPointer(notification, event)}
            onFocusCapture={() => pause(notification.id, "focus")}
            onBlurCapture={(event) => resumeAfterFocus(notification, event)}
        >
            <StatusIcon tone={notification.tone} className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 pr-9">
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
            <button className="absolute right-1 top-1 grid size-9 place-items-center rounded-control hover:bg-surface-raised/45 active:translate-y-px"
                type="button"
                aria-label={dismissLabel(notification.title)}
                onClick={() => dismiss(notification.id)}>
                <CloseIcon className="size-4" />
            </button>
        </article>)}
    </section>;
}
