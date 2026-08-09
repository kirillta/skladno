import { useLayoutEffect, useRef } from "react";
import { useIntl } from "react-intl";
import type { AssistantMessage, GeneralSettings } from "@skladno/shared";
import { Banner } from "../../../ui/primitives.js";
import { AssistantTimelineMessage } from "./AssistantTimelineMessage.js";


export function AssistantTimeline({ state, message, errorDetails, collapsed, assistantMessages, openView, generalSettings, elapsedDuration }: {
    state: "idle" | "streaming" | "error";
    message: string;
    errorDetails?: string;
    collapsed: boolean;
    assistantMessages?: AssistantMessage[];
    openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void;
    generalSettings: GeneralSettings;
    elapsedDuration: string;
}) {
    const intl = useIntl();
    const timeline = useRef<HTMLDivElement>(null);
    const greeting = assistantMessages?.find((item) => item.template === "greeting" || item.kind === "greeting");
    const skillByRequest = new Map(assistantMessages?.flatMap((item) => item.requestId && item.skillId ? [[item.requestId, item.skillId] as const] : []));

    useLayoutEffect(() => {
        if (collapsed)
            return;

        const element = timeline.current;
        if (!element)
            return;

        element.scrollTop = element.scrollHeight;
    }, [assistantMessages, collapsed, state]);

    return <div ref={timeline} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" aria-live="polite">
        {greeting && <AssistantTimelineMessage message={greeting} generalSettings={generalSettings} skillByRequest={skillByRequest} />}
        {assistantMessages?.filter((item) => item !== greeting).map((item) => <AssistantTimelineMessage key={item.id} message={item} openView={openView} generalSettings={generalSettings} skillByRequest={skillByRequest} />)}
        {!assistantMessages?.length && <p className="text-sm leading-6 text-muted">{intl.formatMessage({ id: "assistant.intro" })}</p>}
        {state === "streaming" && <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted" role="status">
            <span className="flex gap-1" aria-hidden="true">
                <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
                <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none [animation-delay:150ms]" />
                <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none [animation-delay:300ms]" />
            </span>
            <span>{intl.formatMessage({ id: "assistant.workingFor" }, { duration: elapsedDuration })}</span>
        </div>}
        {message && <Banner tone="error" className="border-danger/35 bg-surface-raised text-ink" role="alert">
            <div>
                <p>{message}</p>
                {errorDetails && <details className="mt-1 border-t border-border pt-1 text-xs leading-5 text-muted">
                    <summary className="flex min-h-9 cursor-pointer items-center hover:text-ink">{intl.formatMessage({ id: "assistant.errorDetails" })}</summary>
                    <p className="mb-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-4">{errorDetails}</p>
                </details>}
            </div>
        </Banner>}
    </div>;
}
