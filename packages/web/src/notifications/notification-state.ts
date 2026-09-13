import type { Notifications } from "./notifications.js";

type NotificationInput = Parameters<Notifications["notify"]>[0];

export type StoredNotification = Required<Pick<NotificationInput, "tone" | "title">> & Omit<NotificationInput, "tone" | "title" | "durationMs"> & {
    id: string;
    remainingDurationMs: number | null;
};
