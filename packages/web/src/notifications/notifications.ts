export type NotificationTone = "info" | "success" | "warning" | "error";


export interface NotificationAction {
    label: string;
    onAction: () => void;
}


export interface NotificationInput {
    tone: NotificationTone;
    title: string;
    message?: string;
    action?: NotificationAction;
    durationMs?: number | null;
}


export interface NotificationHandle {
    id: string;
    dismiss: () => void;
}


export interface NotifyErrorOptions {
    title?: string;
    fallbackMessage?: string;
    action?: NotificationAction;
}


export interface Notifications {
    notify: (input: NotificationInput) => NotificationHandle;
    notifyError: (error: unknown, options?: NotifyErrorOptions) => NotificationHandle;
    dismiss: (id: string) => void;
    dismissAll: () => void;
}


export interface StoredNotification extends Required<Pick<NotificationInput, "tone" | "title">>, Omit<NotificationInput, "tone" | "title" | "durationMs"> {
    id: string;
    remainingDurationMs: number | null;
}


export const MAX_VISIBLE_NOTIFICATIONS = 3;


export function notificationDuration(tone: NotificationTone, durationMs: number | null | undefined): number | null {
    if (durationMs !== undefined)
        return durationMs;

    if (tone === "info" || tone === "success")
        return 6_000;

    return null;
}
