import { APPLICATION_ERROR, HTTP_STATUS } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import type { EditorialEngineEvent } from "../../editorial/engine/editorial-engine-event.js";


export async function* streamWithAssistantDeadline(
    stream: (signal: AbortSignal) => AsyncIterable<EditorialEngineEvent>,
    signal: AbortSignal,
    timeoutMs: number | undefined,
): AsyncIterable<EditorialEngineEvent> {
    const deadline = new AbortController();
    const combined = AbortSignal.any([signal, deadline.signal]);
    const timer = timeoutMs === undefined
        ? undefined
        : setTimeout(() => deadline.abort(new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_REQUEST_TIMED_OUT, HTTP_STATUS.BAD_REQUEST)), timeoutMs);
    let onAbort: () => void = () => undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(combined.reason);
        combined.addEventListener("abort", onAbort, { once: true });
    });
    const iterator = stream(combined)[Symbol.asyncIterator]();

    try {
        combined.throwIfAborted();
        while (true) {
            const next = await Promise.race([iterator.next(), aborted]);
            combined.throwIfAborted();
            if (next.done)
                return;

            yield next.value;
        }
    } finally {
        if (timer)
            clearTimeout(timer);

        combined.removeEventListener("abort", onAbort);
        // Do not wait for a provider that ignores cancellation to close its iterator.
        void iterator.return?.().catch(() => undefined);
    }
}
