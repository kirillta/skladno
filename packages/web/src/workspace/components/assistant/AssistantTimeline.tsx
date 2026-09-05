import { useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import type { AssistantCapabilityActivity, AssistantMessage, FactCheckClaimPreview, GeneralSettings } from "@skladno/shared";
import { Banner, Button } from "../../../ui/primitives.js";
import { ChevronDownIcon } from "../../../ui/icons.js";
import { FactCheckClaims } from "./FactCheckClaims.js";
import { AssistantTimelineMessage } from "./AssistantTimelineMessage.js";
import { AssistantMarkdown } from "./AssistantMarkdown.js";
import type { StreamedAssistantMessage } from "../../state/assistant-messages-state.js";


export function AssistantTimeline({ state, message, errorDetails, activity, factCheckClaims, collapsed, assistantMessages, streamedMessage, openView, onRetry, generalSettings, elapsedDuration, hasUnavailableAiConnection, openSettings }: {
    state: "idle" | "streaming" | "error";
    message: string;
    errorDetails?: string;
    activity?: AssistantCapabilityActivity;
    factCheckClaims?: FactCheckClaimPreview[];
    collapsed: boolean;
    assistantMessages?: AssistantMessage[];
    streamedMessage?: StreamedAssistantMessage;
    openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void;
    onRetry?: (requestId: string) => void;
    generalSettings: GeneralSettings;
    elapsedDuration: string;
    hasUnavailableAiConnection?: boolean;
    openSettings?: () => void;
}) {
    const intl = useIntl();
    const timeline = useRef<HTMLDivElement>(null);
    const followStream = useRef(true);
    const [atEnd, setAtEnd] = useState(true);
    const previousState = useRef(state);
    const previousCollapsed = useRef(collapsed);
    const messagesLoaded = useRef(assistantMessages !== undefined);
    const initialized = useRef(false);
    const greeting = assistantMessages?.find((item) => item.template === "greeting" || item.kind === "greeting");
    const skillByRequest = new Map(assistantMessages?.flatMap((item) => item.requestId && item.skillId ? [[item.requestId, item.skillId] as const] : []));
    const completedFactCheck = state === "idle" ? [...(assistantMessages ?? [])].reverse().find((item) => item.responseKind === "findings_prepared") : undefined;

    useLayoutEffect(() => {
        if (collapsed)
            return;

        const element = timeline.current;
        if (!element)
            return;

        const loadedPersistedMessages = !messagesLoaded.current && assistantMessages !== undefined;
        if (!initialized.current || loadedPersistedMessages || (!collapsed && previousCollapsed.current))
            element.scrollTop = element.scrollHeight;

        if (state === "streaming" && followStream.current)
            element.scrollTop = element.scrollHeight;

        const completionNeedsScroll = previousState.current === "streaming" && state === "idle" && !element.contains(document.activeElement);

        previousState.current = state;
        previousCollapsed.current = collapsed;
        messagesLoaded.current = assistantMessages !== undefined;
        initialized.current = true;

        if (!loadedPersistedMessages && !completionNeedsScroll)
            return;

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (loadedPersistedMessages || !element.contains(document.activeElement))
                    element.scrollTop = element.scrollHeight;
            });
        });
    }, [assistantMessages, collapsed, factCheckClaims, state, streamedMessage]);


    function trackScroll() {
        const element = timeline.current;
        if (!element)
            return;

        followStream.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
        setAtEnd(followStream.current);
    }


    function scrollToEnd() {
        const element = timeline.current;
        if (!element)
            return;

        element.scrollTop = element.scrollHeight;
        followStream.current = true;
        setAtEnd(true);
    }


    return <div className="relative min-h-0 flex-1">
        <div ref={timeline} onScroll={trackScroll} className="h-full space-y-4 overflow-y-auto px-5 py-5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" aria-live="polite">
            {greeting && <AssistantTimelineMessage message={greeting} generalSettings={generalSettings} skillByRequest={skillByRequest} />}
            {assistantMessages?.filter((item) => item !== greeting).map((item) => <AssistantTimelineMessage key={item.id} message={item} factCheckClaims={item === completedFactCheck ? factCheckClaims : undefined} openView={openView} onRetry={onRetry} generalSettings={generalSettings} skillByRequest={skillByRequest} />)}
            {streamedMessage?.responseKind
                ? <AssistantTimelineMessage message={{ id: streamedMessage.id, articleId: streamedMessage.articleId, role: "assistant", kind: "response", status: streamedMessage.status, responseKind: streamedMessage.responseKind, createdAt: streamedMessage.createdAt, updatedAt: streamedMessage.createdAt }} openView={openView} onRetry={onRetry} generalSettings={generalSettings} skillByRequest={skillByRequest} />
                : streamedMessage?.blocks.length ? <article className="p-0">
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: "assistant.heading" })}</p>
                    {streamedMessage.blocks.map((block, index) => <AssistantMarkdown key={`${streamedMessage.id}-${index}`} content={block} />)}
                </article> : null}
            {!assistantMessages?.length && <p className="text-sm leading-6 text-muted">{intl.formatMessage({ id: "assistant.intro" })}</p>}
            {factCheckClaims?.length && !completedFactCheck ? <FactCheckClaims claims={factCheckClaims} className="mr-6" /> : null}
            {state === "streaming" && <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted" role="status">
                <span className="flex gap-1" aria-hidden="true">
                    <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
                    <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none [animation-delay:150ms]" />
                    <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none [animation-delay:300ms]" />
                </span>
                <span>{activity?.summary ?? intl.formatMessage({ id: "assistant.workingFor" }, { duration: elapsedDuration })}</span>
            </div>}
            {message && <Banner tone="error" className="border-danger/35 bg-surface-raised text-ink" role="alert">
                <div>
                    <p>{message}</p>
                    {hasUnavailableAiConnection && openSettings ? <Button className="mt-2" variant="secondary" onClick={openSettings}>{intl.formatMessage({ id: "assistant.openSettings" })}</Button> : null}
                    {errorDetails && <details className="mt-1 border-t border-border pt-1 text-xs leading-5 text-muted">
                        <summary className="flex min-h-9 cursor-pointer items-center hover:text-ink">{intl.formatMessage({ id: "assistant.errorDetails" })}</summary>
                        <p className="mb-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-4">{errorDetails}</p>
                    </details>}
                </div>
            </Banner>}
        </div>
        {!atEnd && <Button className="absolute bottom-3 left-1/2 inline-grid size-9 -translate-x-1/2 place-items-center rounded-full bg-surface-raised !p-0 shadow-raised" variant="secondary" aria-label={intl.formatMessage({ id: "assistant.scrollToEnd" })} title={intl.formatMessage({ id: "assistant.scrollToEnd" })} onClick={scrollToEnd}>
            <ChevronDownIcon className="size-4" />
        </Button>}
    </div>;
}
