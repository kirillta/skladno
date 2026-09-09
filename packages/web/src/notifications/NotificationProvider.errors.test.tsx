import { cleanup, screen } from "@testing-library/react";
import { APPLICATION_ERROR, ApplicationClientError } from "@skladno/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorMessageId } from "../i18n/errors.js";
import { renderNotifications } from "./NotificationProvider.test-utils.js";


// Product scenario: cross-cutting.redacted-notification-errors

describe("NotificationProvider errors", () => {
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("maps application client errors and hides unknown error details", () => {
        const notifications = renderNotifications();
        notifications.notifyError(new ApplicationClientError("article_not_found", undefined, 404));
        notifications.notifyError(new Error("private diagnostic detail"));
        expect(screen.getByText("Couldn't find that Article. Select an existing Article and try again.")).toBeTruthy();
        expect(screen.getByText("Couldn't finish that action. Your Article was not changed. Try again.")).toBeTruthy();
        expect(screen.queryByText("private diagnostic detail")).toBeNull();
    });

    it("has a specific message for every application error code", () => {
        for (const code of Object.values(APPLICATION_ERROR))
            expect(errorMessageId(code)).not.toBe("errors.generic");
    });

    it("shows one notification when the same error is reported twice", () => {
        const notifications = renderNotifications();
        const error = new ApplicationClientError("article_not_found", undefined, 404);
        notifications.notifyError(error);
        notifications.notifyError(error);
        expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("keeps notifications with different actions separate", () => {
        const notifications = renderNotifications();
        const error = new ApplicationClientError("article_not_found", undefined, 404);
        notifications.notifyError(error, { action: { label: "Retry", onAction: vi.fn() } });
        notifications.notifyError(error, { action: { label: "Retry", onAction: vi.fn() } });
        expect(screen.getAllByRole("alert")).toHaveLength(2);
    });
});
