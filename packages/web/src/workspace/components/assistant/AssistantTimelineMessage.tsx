import { BUILT_IN_SKILL, type AssistantMessage, type BuiltInSkillId, type FactCheckClaimPreview, type GeneralSettings } from "@skladno/shared";
import { Button } from "../../../ui/primitives.js";
import { formatDateTime } from "../../../i18n/formatting.js";
import { useIntl } from "react-intl";
import { responseMessages, selectionPreview, skillMessages } from "./assistant-messages.js";
import { FactCheckClaims } from "./FactCheckClaims.js";


export function AssistantTimelineMessage({ message, factCheckClaims, openView, generalSettings, skillByRequest }: { message: AssistantMessage; factCheckClaims?: FactCheckClaimPreview[]; openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void; generalSettings: GeneralSettings; skillByRequest: ReadonlyMap<string, BuiltInSkillId> }) {
    const intl = useIntl();
    const authorMessage = message.role === "author";
    const skillId = message.skillId ?? (message.requestId ? skillByRequest.get(message.requestId) : undefined);
    const label = message.responseKind === "proposal_prepared" && skillId === BUILT_IN_SKILL.TALKING_POINTS
        ? intl.formatMessage({ id: "assistant.response.talkingPointsProposal" })
        : message.responseKind === "proposal_prepared" && skillId === BUILT_IN_SKILL.NARRATIVE_DRAFT
            ? intl.formatMessage({ id: "assistant.response.narrativeDraftProposal" })
            : message.responseKind ? intl.formatMessage({ id: responseMessages[message.responseKind] }, skillId ? { skill: intl.formatMessage({ id: skillMessages[skillId] }) } : {}) : skillId ? intl.formatMessage({ id: skillMessages[skillId] }) : message.role === "author" ? intl.formatMessage({ id: "assistant.authorMessage" }) : intl.formatMessage({ id: "assistant.heading" });
    const content = message.template === "greeting" ? intl.formatMessage({ id: "assistant.greeting" }) : message.template === "request_cancelled" ? intl.formatMessage({ id: "assistant.requestCancelled" }) : message.template === "request_failed" ? intl.formatMessage({ id: "assistant.requestFailed" }) : message.template === "profile_rebuilt" ? intl.formatMessage({ id: "assistant.profileRebuilt" }, { count: Number(message.content) }) : message.content;
    const view = message.responseKind === "findings_prepared" ? "fact-check" : message.responseKind === "translation_proposal_prepared" ? "translations" : message.responseKind === "proposal_and_findings_prepared" ? "style-profile" : message.responseKind === "proposal_prepared" ? "proposal" : undefined;
    const skillOffset = authorMessage && skillId ? Math.min(Math.max(message.skillOffset ?? 0, 0), content?.length ?? 0) : undefined;
    const selectionText = authorMessage ? message.selectionText : undefined;
    const messageContent = content ?? "";

    return <article className={`rounded-panel border p-3 ${authorMessage ? "ml-6 border-brand/45 bg-brand-soft" : "mr-6 border-border bg-surface-raised"}`} aria-label={authorMessage ? label : undefined}>
        {!authorMessage && <p className="text-xs font-semibold text-muted">{label}</p>}
        {(content || selectionText || skillOffset !== undefined) && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
            {selectionText && <span className="mx-1 inline-flex h-5 max-w-[calc(100%-0.5rem)] items-center align-middle rounded-full border border-border bg-surface-raised px-1.5 text-xs font-semibold text-muted" aria-label={intl.formatMessage({ id: "assistant.articleSelection" })} title={selectionText}>
                <span className="relative -top-px max-w-48 truncate">{selectionPreview(selectionText)}</span>
            </span>}
            {skillOffset === undefined ? messageContent : <>{messageContent.slice(0, skillOffset)}
                <span className="mx-1 inline-flex h-5 items-center align-middle rounded-full border border-brand/45 bg-surface-raised px-1.5 text-xs font-semibold text-brand">{intl.formatMessage({ id: skillMessages[skillId!] })}</span>
                {messageContent.slice(skillOffset)}
            </>}
        </p>}
        {factCheckClaims?.length ? <FactCheckClaims claims={factCheckClaims} embedded className="mt-3" /> : null}
        {view && <Button className="mt-3" variant="secondary" onClick={() => openView?.(view)}>
            {intl.formatMessage({ id: view === "fact-check" || view === "style-profile" ? "assistant.viewFindings" : view === "translations" ? "assistant.reviewTranslation" : "assistant.reviewProposal" })}
        </Button>}
        <time className="mt-2 block text-xs text-muted">{formatDateTime(message.createdAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, generalSettings.timeZone)}</time>
    </article>;
}
