import { BUILT_IN_SKILL, type AssistantMessage, type BuiltInSkillId, type FactCheckClaimPreview, type GeneralSettings } from "@skladno/shared";
import { Button, IconButton } from "../../../ui/primitives.js";
import { StatusIcon, UndoIcon } from "../../../ui/icons.js";
import { formatDateTime } from "../../../i18n/formatting.js";
import { useIntl } from "react-intl";
import { getSelectionPreview, responseMessages, skillMessages } from "./assistant-messages.js";
import { FactCheckClaims } from "./FactCheckClaims.js";
import { AssistantMarkdown } from "./AssistantMarkdown.js";

type AssistantView = "proposal" | "fact-check" | "style-profile" | "translations";


function getMessageLabel(message: AssistantMessage, skillId: BuiltInSkillId | undefined, intl: ReturnType<typeof useIntl>) {
    if (message.responseKind === "proposal_prepared" && skillId === BUILT_IN_SKILL.TALKING_POINTS)
        return intl.formatMessage({ id: "assistant.response.talkingPointsProposal" });

    if (message.responseKind === "proposal_prepared" && skillId === BUILT_IN_SKILL.NARRATIVE_DRAFT)
        return intl.formatMessage({ id: "assistant.response.narrativeDraftProposal" });

    if (message.responseKind)
        return intl.formatMessage({ id: responseMessages[message.responseKind] }, skillId ? { skill: intl.formatMessage({ id: skillMessages[skillId] }) } : {});

    if (skillId)
        return intl.formatMessage({ id: skillMessages[skillId] });

    return message.role === "author"
        ? intl.formatMessage({ id: "assistant.authorMessage" })
        : intl.formatMessage({ id: "assistant.heading" });
}


function resolveMessageContent(message: AssistantMessage, intl: ReturnType<typeof useIntl>) {
    switch (message.template) {
        case "greeting":
            return intl.formatMessage({ id: "assistant.greeting" });
        case "request_cancelled":
            return intl.formatMessage({ id: "assistant.requestCancelled" });
        case "request_failed":
            return intl.formatMessage({ id: "assistant.requestFailed" });
        case "profile_rebuilt":
            return intl.formatMessage({ id: "assistant.profileRebuilt" }, { count: Number(message.content) });
        default:
            return message.content;
    }
}


function getMessageView(responseKind: AssistantMessage["responseKind"]): AssistantView | undefined {
    switch (responseKind) {
        case "findings_prepared":
            return "fact-check";
        case "translation_proposal_prepared":
            return "translations";
        case "proposal_and_findings_prepared":
            return "style-profile";
        case "proposal_prepared":
            return "proposal";
        default:
            return undefined;
    }
}


function getStatusLabel(status: AssistantMessage["status"], intl: ReturnType<typeof useIntl>) {
    switch (status) {
        case "failed":
            return intl.formatMessage({ id: "assistant.status.failed" });
        case "cancelled":
            return intl.formatMessage({ id: "assistant.status.cancelled" });
        case "pending":
            return intl.formatMessage({ id: "assistant.status.pending" });
        case "rejected":
            return intl.formatMessage({ id: "assistant.status.rejected" });
        default:
            return intl.formatMessage({ id: "assistant.status.completed" });
    }
}


function getStatusTone(status: AssistantMessage["status"]): "warning" | "info" | "success" {
    if (status === "failed" || status === "cancelled" || status === "rejected")
        return "warning";

    if (status === "pending")
        return "info";

    return "success";
}


function getViewLabel(view: AssistantView, intl: ReturnType<typeof useIntl>) {
    if (view === "fact-check" || view === "style-profile")
        return intl.formatMessage({ id: "assistant.viewFindings" });

    if (view === "translations")
        return intl.formatMessage({ id: "assistant.reviewTranslation" });

    return intl.formatMessage({ id: "assistant.reviewProposal" });
}


export function AssistantTimelineMessage({ message, factCheckClaims, openView, onRetry, onCheckpoint, generalSettings, skillByRequest }: { message: AssistantMessage; factCheckClaims?: FactCheckClaimPreview[]; openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void; onRetry?: (requestId: string) => void; onCheckpoint?: (messageId: string) => void; generalSettings: GeneralSettings; skillByRequest: ReadonlyMap<string, BuiltInSkillId> }) {
    const intl = useIntl();
    const authorMessage = message.role === "author";
    const skillId = message.skillId ?? (message.requestId ? skillByRequest.get(message.requestId) : undefined);
    const label = getMessageLabel(message, skillId, intl);
    const content = resolveMessageContent(message, intl);
    const view = getMessageView(message.responseKind);
    const skillOffset = authorMessage && skillId ? Math.min(Math.max(message.skillOffset ?? 0, 0), content?.length ?? 0) : undefined;
    const selectionText = authorMessage ? message.selectionText : undefined;
    const messageContent = content ?? "";
    const retryRequestId = message.requestId;
    const handoffOwnsContent = !authorMessage && Boolean(view);
    const messageStatusLabel = getStatusLabel(message.status, intl);
    const messageDateTime = formatDateTime(message.createdAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, generalSettings.timeZone);
    const skillUsedLabel = message.skillSource ? intl.formatMessage({ id: "assistant.skillUsed" }) : undefined;
    const skillTitle = skillId ? intl.formatMessage({ id: skillMessages[skillId] }) : undefined;

    return <article className={authorMessage ? "ml-6 rounded-panel border border-brand/45 bg-brand-soft p-3" : "p-0"} aria-label={authorMessage ? label : undefined}>
        {!authorMessage && <p className="text-xs font-semibold text-muted">{label}</p>}
        {(authorMessage && (content || selectionText || skillOffset !== undefined)) && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
            {selectionText && <span className="mx-1 inline-flex h-5 max-w-[calc(100%-0.5rem)] items-center align-middle rounded-full border border-border bg-surface-raised px-1.5 text-xs font-semibold text-muted" aria-label={intl.formatMessage({ id: "assistant.articleSelection" })} title={selectionText}>
                <span className="relative -top-px max-w-48 truncate">{getSelectionPreview(selectionText)}</span>
            </span>}
            {skillOffset === undefined ? messageContent : <>{messageContent.slice(0, skillOffset)}
                <span className="mx-1 inline-flex h-5 items-center align-middle rounded-full border border-brand/45 bg-surface-raised px-1.5 text-xs font-semibold text-brand">{skillId && intl.formatMessage({ id: skillMessages[skillId] })}</span>
                {messageContent.slice(skillOffset)}
            </>}
        </p>}
        {!authorMessage && messageContent && !handoffOwnsContent && (message.template || message.kind === "greeting" || message.kind === "status" ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{messageContent}</p> : <AssistantMarkdown content={messageContent} />)}
        {factCheckClaims?.length ? <FactCheckClaims claims={factCheckClaims} embedded className="mt-3" /> : null}
        {view && message.status !== "rejected" && <Button className="mt-3" variant="secondary" onClick={() => openView?.(view)}>
            {getViewLabel(view, intl)}
        </Button>}
        {(message.status === "failed" || message.status === "cancelled") && retryRequestId && <Button className="mt-3" variant="secondary" onClick={() => onRetry?.(retryRequestId)}>{intl.formatMessage({ id: "assistant.retry" })}</Button>}
        {!authorMessage && <p className="mt-2 flex items-center gap-1 text-xs text-muted">
            <StatusIcon className="size-3" tone={getStatusTone(message.status)} />
            <span>{messageStatusLabel}</span>
            {skillUsedLabel && <span title={skillTitle}>· {skillUsedLabel}</span>}
            <span>·</span>
            <time>{messageDateTime}</time>
        </p>}
        {authorMessage && <div className="mt-2 flex items-center justify-end gap-2">
            <time className="text-xs text-muted">{messageDateTime}</time>
            {message.requestId && <IconButton className="!size-6" variant="secondary" label={intl.formatMessage({ id: "assistant.checkpoint.accessible" }, { time: messageDateTime })} title={intl.formatMessage({ id: "assistant.checkpoint.action" })} onClick={() => onCheckpoint?.(message.id)}>
                <UndoIcon className="size-3" />
            </IconButton>}
        </div>}
    </article>;
}
