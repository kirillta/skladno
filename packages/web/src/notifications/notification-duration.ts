import type { Notifications } from "./notifications.js";

type NotificationTone = Parameters<Notifications["notify"]>[0]["tone"];

const NOTIFICATION_FADE_OUT_DURATION = 6_000;


export function getNotificationDuration(tone: NotificationTone, durationMs: number | null | undefined): number | null {
    if (durationMs !== undefined)
        return durationMs;

    if (tone === "info" || tone === "success")
        return NOTIFICATION_FADE_OUT_DURATION;

    return null;
}
