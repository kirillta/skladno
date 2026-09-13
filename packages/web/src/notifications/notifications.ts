export interface Notifications {
    notify: (input: {
        tone: "info" | "success" | "warning" | "error";
        title: string;
        message?: string;
        action?: { label: string; onAction: () => void };
        durationMs?: number | null;
    }) => { id: string; dismiss: () => void };
    notifyError: (error: unknown, options?: {
        title?: string;
        fallbackMessage?: string;
        action?: { label: string; onAction: () => void };
    }) => { id: string; dismiss: () => void };
    dismiss: (id: string) => void;
    dismissAll: () => void;
}
