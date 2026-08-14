import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { ApplicationClientError } from "@skladno/shared";
import { errorMessageId } from "../i18n/errors.js";
import { NotificationViewport } from "./NotificationViewport.js";
import { MAX_VISIBLE_NOTIFICATIONS, notificationDuration, type NotificationInput, type Notifications, type NotifyErrorOptions, type StoredNotification } from "./notifications.js";


const NotificationsContext = createContext<Notifications | undefined>(undefined);


type PauseReason = "pointer" | "focus" | "document";


function NotificationTimer({ notification, paused, dismiss, start }: {
    notification: StoredNotification;
    paused: boolean;
    dismiss: (id: string) => void; start: (id: string) => void
}) {
    useEffect(() => {
        if (notification.remainingDurationMs === null || paused)
            return;

        start(notification.id);
        const timer = window.setTimeout(() => dismiss(notification.id), notification.remainingDurationMs);
        return () => window.clearTimeout(timer);
    }, [dismiss, notification.id, notification.remainingDurationMs, paused, start]);

    return null;
}


export function NotificationProvider({ children }: { children: ReactNode }) {
    const intl = useIntl();
    const [notifications, setNotifications] = useState<StoredNotification[]>([]);
    const [pauseReasons, setPauseReasons] = useState<Record<string, PauseReason[]>>({});
    const notificationsRef = useRef<StoredNotification[]>([]);
    const pauseReasonsRef = useRef<Record<string, PauseReason[]>>({});
    const timerStartedAt = useRef(new Map<string, number>());
    const nextId = useRef(0);

    useEffect(() => {
        notificationsRef.current = notifications;
    }, [notifications]);

    useEffect(() => {
        pauseReasonsRef.current = pauseReasons;
    }, [pauseReasons]);

    const dismiss = useCallback((id: string) => {
        timerStartedAt.current.delete(id);
        setNotifications((current) => current.filter((notification) => notification.id !== id));
        setPauseReasons((current) => {
            if (!(id in current))
                return current;

            const next = { ...current };
            delete next[id];

            return next;
        });
    }, []);

    const dismissAll = useCallback(() => {
        timerStartedAt.current.clear();
        setNotifications([]);
        setPauseReasons({});
    }, []);

    const startTimer = useCallback((id: string) => {
        timerStartedAt.current.set(id, Date.now());
    }, []);

    const notify = useCallback((input: NotificationInput) => {
        const id = `notification-${nextId.current++}`;
        const notification: StoredNotification = {
            id,
            tone: input.tone,
            title: input.title,
            message: input.message,
            action: input.action,
            remainingDurationMs: notificationDuration(input.tone, input.durationMs),
        };

        setNotifications((current) => [...current, notification]);
        return { id, dismiss: () => dismiss(id) };
    }, [dismiss]);

    const notifyError = useCallback((error: unknown, options: NotifyErrorOptions = {}) => notify({
        tone: "error",
        title: options.title ?? intl.formatMessage({ id: "notifications.errorTitle" }),
        message: error instanceof ApplicationClientError
            ? intl.formatMessage({ id: errorMessageId(error.code) }, error.parameters)
            : options.fallbackMessage ?? intl.formatMessage({ id: "errors.generic" }),
        action: options.action,
    }), [intl, notify]);

    const setPaused = useCallback((id: string, reason: PauseReason, paused: boolean) => {
        const currentReasons = pauseReasonsRef.current[id] ?? [];
        const hasReason = currentReasons.includes(reason);

        if (paused === hasReason)
            return;

        if (paused && currentReasons.length === 0) {
            const startedAt = timerStartedAt.current.get(id);

            if (startedAt !== undefined) {
                const elapsed = Date.now() - startedAt;
                timerStartedAt.current.delete(id);
                setNotifications((current) => current.map((notification) => notification.id === id && notification.remainingDurationMs !== null ? {
                    ...notification,
                    remainingDurationMs: Math.max(0, notification.remainingDurationMs - elapsed),
                } : notification));
            }
        }

        setPauseReasons((current) => {
            const reasons = current[id] ?? [];
            const nextReasons = paused ? [...reasons, reason] : reasons.filter((item) => item !== reason);

            return { ...current, [id]: nextReasons };
        });
    }, []);

    useEffect(() => {
        function updateDocumentPause() {
            notificationsRef.current.slice(0, MAX_VISIBLE_NOTIFICATIONS).forEach((notification) => setPaused(notification.id, "document", document.hidden));
        }


        document.addEventListener("visibilitychange", updateDocumentPause);
        updateDocumentPause();

        return () => document.removeEventListener("visibilitychange", updateDocumentPause);
    }, [setPaused]);

    const value = useMemo<Notifications>(() => ({ notify, notifyError, dismiss, dismissAll }), [dismiss, dismissAll, notify, notifyError]);
    const visibleNotifications = notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS);

    return <NotificationsContext.Provider value={value}>
        {children}
        {visibleNotifications.map((notification) => <NotificationTimer key={notification.id} notification={notification} paused={(pauseReasons[notification.id]?.length ?? 0) > 0} dismiss={dismiss} start={startTimer} />)}
        <NotificationViewport notifications={[...visibleNotifications].reverse()}
            label={intl.formatMessage({ id: "notifications.viewport" })}
            dismissLabel={(title) => intl.formatMessage({ id: "notifications.dismiss" }, { title })}
            dismiss={dismiss}
            pause={(id, reason) => setPaused(id, reason, true)}
            resume={(id, reason) => setPaused(id, reason, false)} />
    </NotificationsContext.Provider>;
}


export function useNotifications(): Notifications {
    const notifications = useContext(NotificationsContext);

    if (!notifications)
        throw new Error("useNotifications must be used within a NotificationProvider.");

    return notifications;
}
