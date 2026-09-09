import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { message } from "../i18n/test-message.js";
import { renderNotifications } from "./NotificationProvider.test-utils.js";

describe("NotificationProvider behavior", () => {
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
        fireEvent.click(screen.getByRole("button", { name: message("draftSave.retry") }));
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Could not save")).toBeNull();
    });

    it("uses the appropriate live-region roles and accessible dismiss labels", () => {
        const notifications = renderNotifications();
        notifications.notify({ tone: "info", title: "Information" });
        notifications.notify({ tone: "error", title: "Save failed" });
        expect(screen.getByRole("status").textContent).toContain("Information");
        expect(screen.getByRole("alert").textContent).toContain("Save failed");
        const dismiss = screen.getByRole("button", { name: message("notifications.dismiss", { title: "Save failed" }) });
        expect(dismiss.querySelector("svg")?.classList.contains("size-4")).toBe(true);
        expect(dismiss.classList.contains("right-1")).toBe(true);
        expect(dismiss.classList.contains("top-1")).toBe(true);
    });
});
