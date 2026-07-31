import { parse } from "@formatjs/icu-messageformat-parser";
import { messages, type MessageId } from "./messages.js";

export function validateCatalog(catalog: Record<string, string>): asserts catalog is Record<MessageId, string> {
    const expected = Object.keys(messages).sort();
    const actual = Object.keys(catalog).sort();
    if (expected.join("\n") !== actual.join("\n"))
        throw new Error("Locale catalog must contain exactly the canonical message IDs.");

    for (const message of Object.values(catalog))
        parse(message, { captureLocation: false });
}
