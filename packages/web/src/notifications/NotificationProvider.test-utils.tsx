/* eslint-disable project-style/no-production-intl-provider */

import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { IntlProvider } from "react-intl";
import { messages } from "../i18n/messages.js";
import { NotificationProvider, useNotifications } from "./NotificationProvider.js";
import type { Notifications } from "./notifications.js";


function NotificationHarness({ onReady }: { onReady: (notifications: Notifications) => void }) {
    const notifications = useNotifications();
    useEffect(() => onReady(notifications), [notifications, onReady]);
    return <main />;
}


export function renderNotifications() {
    let notifications: Notifications | undefined;
    render(<IntlProvider locale="en" messages={messages}><NotificationProvider><NotificationHarness onReady={(value) => {
        notifications = value;
    }} /></NotificationProvider></IntlProvider>);

    if (!notifications)
        throw new Error("Notification harness did not initialize.");

    return {
        notify(input: Parameters<Notifications["notify"]>[0]) {
            let handle: ReturnType<Notifications["notify"]> | undefined;
            act(() => {
                handle = notifications?.notify(input);
            });
            if (!handle)
                throw new Error("Notification was not created.");

            return handle;
        },
        notifyError(error: unknown, options?: Parameters<Notifications["notifyError"]>[1]) {
            let handle: ReturnType<Notifications["notifyError"]> | undefined;
            act(() => {
                handle = notifications?.notifyError(error, options);
            });
            if (!handle)
                throw new Error("Error notification was not created.");

            return handle;
        },
    } satisfies Pick<Notifications, "notify" | "notifyError">;
}
