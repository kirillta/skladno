import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { IntlProvider } from "react-intl";
import { ApplicationClientError } from "@skladno/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../i18n/messages.js";
import { NotificationProvider, useNotifications } from "./NotificationProvider.js";
import type { Notifications } from "./notifications.js";


function NotificationHarness({ onReady }: { onReady: (notifications: Notifications) => void }) {
    const notifications = useNotifications();

    useEffect(() => onReady(notifications), [notifications, onReady]);

    return <main>Application content</main>;
}


function renderNotifications() {
    let notifications: Notifications | undefined;
    render(<IntlProvider locale="en" messages={messages}>
        <NotificationProvider>
            <NotificationHarness onReady={(value) => {
                notifications = value;
            }} />
        </NotificationProvider>
    </IntlProvider>);

    if (!notifications)
        throw new Error("Notification harness did not initialize.");

    return {
        notify(input) {
            let handle: ReturnType<Notifications["notify"]> | undefined;
            act(() => {
                handle = notifications?.notify(input);
            });

            if (!handle)
                throw new Error("Notification was not created.");

            return handle;
        },
        notifyError(error, options?: Parameters<Notifications["notifyError"]>[1]) {
            let handle: ReturnType<Notifications["notifyError"]> | undefined;
            act(() => {
                handle = notifications?.notifyError(error, options);
            });

            if (!handle)
                throw new Error("Error notification was not created.");

            return handle;
        },
        dismiss(id) {
            act(() => notifications?.dismiss(id));
        },
        dismissAll() {
            act(() => notifications?.dismissAll());
        },
    } satisfies Notifications;
}


describe("NotificationProvider", () => {
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });


    it("shows a maximum of three notifications and promotes queued notifications after dismissal", () => {
        const notifications = renderNotifications();
        const handles = ["One", "Two", "Three", "Four"].map((title) => notifications.notify({ tone: "warning", title }));

        expect(screen.getAllByRole("alert")).toHaveLength(3);
        expect(screen.queryByText("Four")).toBeNull();

        act(() => handles[0].dismiss());

        expect(screen.getAllByRole("alert")).toHaveLength(3);
        expect(screen.getByText("Four").closest("article")?.className).toContain("notification-enter");
    });


    it("auto-dismisses info and success notifications while keeping warnings and errors visible", () => {
        vi.useFakeTimers();
        const notifications = renderNotifications();
        notifications.notify({ tone: "info", title: "Information" });
        notifications.notify({ tone: "success", title: "Saved" });
        notifications.notify({ tone: "warning", title: "Warning" });
        notifications.notify({ tone: "error", title: "Error" });

        act(() => vi.advanceTimersByTime(6_000));

        expect(screen.queryByText("Information")).toBeNull();
        expect(screen.queryByText("Saved")).toBeNull();
        expect(screen.getByText("Warning")).toBeTruthy();
        expect(screen.getByText("Error")).toBeTruthy();
    });


    it("pauses an auto-dismiss timer while a notification is hovered", () => {
        vi.useFakeTimers();
        const notifications = renderNotifications();
        notifications.notify({ tone: "success", title: "Saved" });
        const popup = screen.getByRole("status");

        act(() => vi.advanceTimersByTime(2_000));
        fireEvent.pointerEnter(popup);
        act(() => vi.advanceTimersByTime(6_000));
        expect(screen.getByText("Saved")).toBeTruthy();

        fireEvent.pointerLeave(popup);
        act(() => vi.advanceTimersByTime(3_999));
        expect(screen.getByText("Saved")).toBeTruthy();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.queryByText("Saved")).toBeNull();
    });


    it("runs an action once and dismisses its notification", () => {
        const notifications = renderNotifications();
        const onAction = vi.fn();
        notifications.notify({ tone: "error", title: "Could not save", action: { label: "Retry", onAction } });

        fireEvent.click(screen.getByRole("button", { name: "Retry" }));

        expect(onAction).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Could not save")).toBeNull();
    });


    it("maps application client errors and hides unknown error details", () => {
        const notifications = renderNotifications();
        notifications.notifyError(new ApplicationClientError("article_not_found", undefined, 404));
        notifications.notifyError(new Error("private diagnostic detail"));

        expect(screen.getByText("Article not found. Select an existing article and try again.")).toBeTruthy();
        expect(screen.getByText("The local service could not complete this request. Try again.")).toBeTruthy();
        expect(screen.queryByText("private diagnostic detail")).toBeNull();
    });


    it("uses the appropriate live-region roles and accessible dismiss labels", () => {
        const notifications = renderNotifications();
        notifications.notify({ tone: "info", title: "Information" });
        notifications.notify({ tone: "error", title: "Save failed" });

        expect(screen.getByRole("status").textContent).toContain("Information");
        expect(screen.getByRole("alert").textContent).toContain("Save failed");
        const dismiss = screen.getByRole("button", { name: "Dismiss notification: Save failed" });
        expect(dismiss).toBeTruthy();
        expect(dismiss.querySelector("svg")?.classList.contains("size-4")).toBe(true);
        expect(dismiss.classList.contains("right-1")).toBe(true);
        expect(dismiss.classList.contains("top-1")).toBe(true);
    });


});
