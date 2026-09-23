import { BUILT_IN_SKILL, isBuiltInSkillId, type AssistantMessage, type FactCheckClaimPreview, type GeneralSettings } from "@skladno/shared";
import { Button, IconButton } from "../../../ui/primitives.js";
import { StatusIcon, UndoIcon } from "../../../ui/icons.js";
import { formatDateTime } from "../../../i18n/formatting.js";
import { useIntl } from "react-intl";
import { getSelectionPreview, responseMessages, skillMessages } from "./assistant-messages.js";
import { FactCheckClaims } from "./FactCheckClaims.js";
import { AssistantMarkdown } from "./AssistantMarkdown.js";


type AssistantView = "proposal" | "fact-check" | "style-profile" | "translations";
type AssistantViewHandler = (view: AssistantView) => void;
type Intl = ReturnType<typeof useIntl>;


interface MessagePresentation {
    authorMessage: boolean;
    skillId?: string;
    label: string;
    messageContent: string;
    skillOffset?: number;
    selectionText?: string;
    view: AssistantView | undefined;
    handoffOwnsContent: boolean;
    dateTime: string;
}


function getSkillLabel(skillId: string, intl: Intl): string {
    return isBuiltInSkillId(skillId) ? intl.formatMessage({ id: skillMessages[skillId] }) : skillId;
}


function getMessageLabel(message: AssistantMessage, skillId: string | undefined, intl: Intl): string {
    if (message.responseKind === "proposal_prepared" && skillId === BUILT_IN_SKILL.TALKING_POINTS)
        return intl.formatMessage({ id: "assistant.response.talkingPointsProposal" });

    if (message.responseKind === "proposal_prepared" && skillId === BUILT_IN_SKILL.NARRATIVE_DRAFT)
        return intl.formatMessage({ id: "assistant.response.narrativeDraftProposal" });

    if (message.responseKind)
        return intl.formatMessage({ id: responseMessages[message.responseKind] }, skillId ? { skill: getSkillLabel(skillId, intl) } : {});

    if (skillId)
        return getSkillLabel(skillId, intl);

    return message.role === "author"
        ? intl.formatMessage({ id: "assistant.authorMessage" })
        : intl.formatMessage({ id: "assistant.heading" });
}


function resolveMessageContent(message: AssistantMessage, intl: Intl): string | undefined {
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


function getStatusLabel(status: AssistantMessage["status"], intl: Intl): string {
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


function getViewLabel(view: AssistantView, intl: Intl): string {
    if (view === "fact-check" || view === "style-profile")
        return intl.formatMessage({ id: "assistant.viewFindings" });

    if (view === "translations")
        return intl.formatMessage({ id: "assistant.reviewTranslation" });

    return intl.formatMessage({ id: "assistant.reviewProposal" });
}


function AuthorMessageContent({ visible, content, selectionText, skillOffset, skillId, intl }: { visible: boolean; content: string; selectionText?: string; skillOffset?: number; skillId?: string; intl: Intl }) {
    if (!visible || (!content && !selectionText && skillOffset === undefined))
        return null;

    return <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
        {selectionText && <span className="mx-1 inline-flex h-5 max-w-[calc(100%-0.5rem)] items-center align-middle rounded-full border border-border bg-surface-raised px-1.5 text-xs font-semibold text-muted" aria-label={intl.formatMessage({ id: "assistant.articleSelection" })} title={selectionText}>
            <span className="relative -top-px max-w-48 truncate">{getSelectionPreview(selectionText)}</span>
        </span>}
        {skillOffset === undefined ? content : <>{content.slice(0, skillOffset)}
            <span className="mx-1 inline-flex h-5 items-center align-middle rounded-full border border-brand/45 bg-surface-raised px-1.5 text-xs font-semibold text-brand">{skillId && getSkillLabel(skillId, intl)}</span>
            {content.slice(skillOffset)}
        </>}
    </p>;
}


function AssistantMessageContent({ message, visible, content, handoffOwnsContent }: { message: AssistantMessage; visible: boolean; content: string; handoffOwnsContent: boolean }) {
    if (!visible || !content || handoffOwnsContent)
        return null;

    if (message.template || message.kind === "greeting" || message.kind === "status")
        return <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{content}</p>;

    return <AssistantMarkdown content={content} />;
}


function AssistantMessageActions({ message, skillId, view, openView, openSkillFolder, onRetry, intl }: { message: AssistantMessage; skillId: string | undefined; view: AssistantView | undefined; openView?: AssistantViewHandler; openSkillFolder?: (requestId: string) => void; onRetry?: (requestId: string) => void; intl: Intl }) {
    return <>
        {view && message.status !== "rejected" && <Button className="mt-3" variant="secondary" onClick={() => openView?.(view)}>
            {getViewLabel(view, intl)}
        </Button>}
        {message.role !== "author" && skillId === BUILT_IN_SKILL.SKILL_CREATOR && message.status === "completed" && message.requestId && openSkillFolder && <Button className="mt-3" variant="secondary" onClick={() => openSkillFolder(message.requestId!)}>
            {intl.formatMessage({ id: "assistant.openSkillFolder" })}
        </Button>}
        {(message.status === "failed" || message.status === "cancelled") && message.requestId && onRetry && <Button className="mt-3" variant="secondary" onClick={() => onRetry(message.requestId!)}>{intl.formatMessage({ id: "assistant.retry" })}</Button>}
    </>;
}


function AssistantMessageMetadata({ message, dateTime, skillId, intl, onCheckpoint }: { message: AssistantMessage; dateTime: string; skillId: string | undefined; intl: Intl; onCheckpoint?: (messageId: string) => void }) {
    if (message.role === "author")
        return <div className="mt-2 flex items-center justify-end gap-2">
            <time className="text-xs text-muted">{dateTime}</time>
            {message.requestId && <IconButton className="!size-6" variant="secondary" label={intl.formatMessage({ id: "assistant.checkpoint.accessible" }, { time: dateTime })} title={intl.formatMessage({ id: "assistant.checkpoint.action" })} onClick={() => onCheckpoint?.(message.id)}>
                <UndoIcon className="size-3" />
            </IconButton>}
        </div>;

    const statusLabel = getStatusLabel(message.status, intl);
    const skillUsedLabel = skillId ? intl.formatMessage({ id: "assistant.skillUsed" }) : undefined;
    const skillTitle = skillId ? getSkillLabel(skillId, intl) : undefined;

    return <p className="mt-2 flex items-center gap-1 text-xs text-muted">
        <StatusIcon className="size-3" tone={getStatusTone(message.status)} />
        <span>{statusLabel}</span>
        {skillUsedLabel && <span className="before:mr-1 before:content-['\00b7']" title={skillTitle}>{skillUsedLabel}</span>}
        <span aria-hidden="true" className="before:content-['\00b7']" />
        <time>{dateTime}</time>
    </p>;
}


function getMessagePresentation(message: AssistantMessage, generalSettings: GeneralSettings, skillByRequest: ReadonlyMap<string, string>, intl: Intl): MessagePresentation {
    const authorMessage = message.role === "author";
    const skillId = message.skillId ?? (message.requestId ? skillByRequest.get(message.requestId) : undefined);
    const content = resolveMessageContent(message, intl);
    const view = getMessageView(message.responseKind);

    return {
        authorMessage,
        skillId,
        label: getMessageLabel(message, skillId, intl),
        messageContent: content ?? "",
        skillOffset: authorMessage && skillId ? Math.min(Math.max(message.skillOffset ?? 0, 0), content?.length ?? 0) : undefined,
        selectionText: authorMessage ? message.selectionText : undefined,
        view,
        handoffOwnsContent: !authorMessage && Boolean(view),
        dateTime: formatDateTime(message.createdAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, generalSettings.timeZone),
    };
}


export function AssistantTimelineMessage({ message, factCheckClaims, openView, openSkillFolder, onRetry, onCheckpoint, generalSettings, skillByRequest }: { message: AssistantMessage; factCheckClaims?: FactCheckClaimPreview[]; openView?: AssistantViewHandler; openSkillFolder?: (requestId: string) => void; onRetry?: (requestId: string) => void; onCheckpoint?: (messageId: string) => void; generalSettings: GeneralSettings; skillByRequest: ReadonlyMap<string, string> }) {
    const intl = useIntl();
    const { authorMessage, skillId, label, messageContent, skillOffset, selectionText, view, handoffOwnsContent, dateTime } = getMessagePresentation(message, generalSettings, skillByRequest, intl);

    return <article className={authorMessage ? "ml-6 rounded-panel border border-brand/45 bg-brand-soft p-3" : "p-0"} aria-label={authorMessage ? label : undefined}>
        {!authorMessage && <p className="text-xs font-semibold text-muted">{label}</p>}
        <AuthorMessageContent visible={authorMessage} content={messageContent} selectionText={selectionText} skillOffset={skillOffset} skillId={skillId} intl={intl} />
        <AssistantMessageContent message={message} visible={!authorMessage} content={messageContent} handoffOwnsContent={handoffOwnsContent} />
        {factCheckClaims?.length ? <FactCheckClaims claims={factCheckClaims} embedded className="mt-3" /> : null}
        <AssistantMessageActions message={message} skillId={skillId} view={view} openView={openView} openSkillFolder={openSkillFolder} onRetry={onRetry} intl={intl} />
        <AssistantMessageMetadata message={message} dateTime={dateTime} skillId={skillId} intl={intl} onCheckpoint={onCheckpoint} />
    </article>;
}
