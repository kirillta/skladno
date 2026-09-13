import { createIntl } from "react-intl";
import { messages, type MessageId } from "./messages.js";

const intl = createIntl({ locale: "en", messages });


export function getMessage(id: MessageId, values?: Record<string, string | number>): string {
    return intl.formatMessage({ id }, values);
}
