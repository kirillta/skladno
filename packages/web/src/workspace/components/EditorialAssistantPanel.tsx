import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { BUILT_IN_SKILL, KEY_BINDING_COMMAND, builtInSkills, type Article, type AssistantMessage, type AssistantResponseKind, type BuiltInSkillId, type KeyBindingOverrides, type UpdateArticleInput } from "@skladno/shared";
import { Banner, Button, Status, TextareaField } from "../../ui/primitives.js";
import { AssistantIcon, ChevronDownIcon, ChevronRightIcon, CloseIcon, SendIcon } from "../../ui/icons.js";
import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";

const skillMessages: Record<BuiltInSkillId, "assistant.skill.talkingPoints.label" | "assistant.skill.narrativeDraft.label" | "assistant.skill.flowAndClarity.label" | "assistant.skill.factChecking.label" | "assistant.skill.styleReview.label" | "assistant.skill.translation.label"> = {
    talking_points: "assistant.skill.talkingPoints.label",
    narrative_draft: "assistant.skill.narrativeDraft.label",
    flow_and_clarity: "assistant.skill.flowAndClarity.label",
    fact_checking: "assistant.skill.factChecking.label",
    style_review: "assistant.skill.styleReview.label",
    translation: "assistant.skill.translation.label",
};


const responseMessages: Record<AssistantResponseKind, "assistant.response.conversation" | "assistant.response.skill" | "assistant.response.proposal" | "assistant.response.findings" | "assistant.response.proposalAndFindings" | "assistant.response.translation" | "assistant.requestCancelled" | "assistant.requestFailed"> = {
    editorial_conversation: "assistant.response.conversation",
    skill_response: "assistant.response.skill",
    proposal_prepared: "assistant.response.proposal",
    findings_prepared: "assistant.response.findings",
    proposal_and_findings_prepared: "assistant.response.proposalAndFindings",
    translation_proposal_prepared: "assistant.response.translation",
    request_cancelled: "assistant.requestCancelled",
    request_failed: "assistant.requestFailed",
};


export function EditorialAssistantPanel({ state, message, onRequest, onCancel, collapsed, setCollapsed, language, assistantMessages, dispatcher, shortcutOverrides, openView }: {
    state: "idle" | "streaming" | "error";
    message: string;
    onRequest: (authorMessage: string, skillId?: BuiltInSkillId, language?: string) => Promise<void>;
    onCancel: () => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    language: string;
    assistantMessages?: AssistantMessage[];
    article?: Article;
    updateArticle?: (articleId: string, input: UpdateArticleInput) => Promise<unknown>;
    dispatcher?: KeyBindingDispatcher;
    shortcutOverrides?: KeyBindingOverrides;
    openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void;
}) {
    const intl = useIntl();
    const [guidance, setGuidance] = useState("");
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<BuiltInSkillId>();
    const greeting = assistantMessages?.find((item) => item.template === "greeting" || item.kind === "greeting");
    const canSend = state !== "streaming" && (Boolean(selectedSkill) || Boolean(guidance.trim()));

    const selectSkill = useCallback((skill: BuiltInSkillId) => {
        setQuickActionsOpen(false);
        setSelectedSkill(skill);
        requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("[data-assistant-composer]")?.focus());
    }, []);

    const send = useCallback(() => {
        if (!canSend)
            return;

        void onRequest(guidance, selectedSkill, selectedSkill === BUILT_IN_SKILL.TRANSLATION ? language : undefined)
            .then(() => {
                setGuidance("");
                setSelectedSkill(undefined);
            });
    }, [canSend, guidance, language, onRequest, selectedSkill]);

    useEffect(() => {
        const unregisterSend = dispatcher?.register(KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, send);
        const unregisterStop = dispatcher?.register(KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, onCancel);
        return () => {
            unregisterSend?.();
            unregisterStop?.();
        };
    }, [dispatcher, onCancel, send]);

    if (collapsed)
        return <aside data-workspace-panel="editorial-assistant" className="flex h-full w-full flex-col border-l border-border bg-surface-supporting p-1" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
            <header className="flex min-h-18 w-full items-center justify-center"><Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.expand" })} onClick={() => setCollapsed(false)}><AssistantIcon className="size-5 text-brand" /></Button></header>
        </aside>;

    return <aside data-workspace-panel="editorial-assistant" className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
        <header className="flex min-h-18 items-center border-b border-border px-5"><AssistantIcon className="size-5 shrink-0 text-brand" /><h2 className="ml-3 text-base font-semibold">{intl.formatMessage({ id: "assistant.heading" })}</h2><Button className="ml-auto inline-grid size-9 place-items-center p-1" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.collapse" }), KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}><ChevronRightIcon className="size-3" /></Button></header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
            {greeting && <TimelineMessage message={greeting} />}
            {assistantMessages?.filter((item) => item !== greeting).map((item) => <TimelineMessage key={item.id} message={item} openView={openView} />)}
            {!assistantMessages?.length && <p className="text-sm leading-6 text-muted">{intl.formatMessage({ id: "assistant.intro" })}</p>}
            {state === "streaming" && <Status label={intl.formatMessage({ id: "assistant.preparing" })} tone="info" />}
            {message && <Banner tone="error" role="alert">{message}</Banner>}
        </div>
        <footer className="shrink-0 border-t border-border px-5 py-4">
            <div className="relative mb-3">
                {quickActionsOpen && <div className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-panel border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "assistant.quickActions" })}>
                    {builtInSkills.map((skill) => <Button className="flex w-full justify-start text-xs" key={skill} disabled={state === "streaming"} variant="quiet" onClick={() => selectSkill(skill)}>{intl.formatMessage({ id: skillMessages[skill] })}</Button>)}
                </div>}
                <Button className="flex items-center gap-2" variant="secondary" aria-expanded={quickActionsOpen} onClick={() => setQuickActionsOpen((open) => !open)}>{intl.formatMessage({ id: "assistant.quickActions" })}<ChevronDownIcon className={`size-4 ${quickActionsOpen ? "rotate-180" : ""}`} /></Button>
            </div>
            {selectedSkill && <span className="mb-2 inline-flex items-center gap-1 rounded-control border border-border bg-surface-raised px-2 py-1 text-xs" aria-label={intl.formatMessage({ id: "assistant.selectedSkill" }, { skill: intl.formatMessage({ id: skillMessages[selectedSkill] }) })}>{intl.formatMessage({ id: skillMessages[selectedSkill] })}<Button className="inline-grid size-5 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.removeSkill" }, { skill: intl.formatMessage({ id: skillMessages[selectedSkill] }) })} onClick={() => setSelectedSkill(undefined)}><CloseIcon className="size-3" /></Button></span>}
            <div className="relative"><TextareaField data-assistant-composer className="min-h-25 resize-y pr-12" aria-label={intl.formatMessage({ id: "assistant.guidance" })} value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder={intl.formatMessage({ id: "assistant.guidancePlaceholder" })} /><Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center p-1" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.send" }), KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={!canSend} onClick={send}><SendIcon className="size-4" /></Button></div>
            {state === "streaming" && <Button className="mt-3" variant="danger" title={shortcutHint(intl.formatMessage({ id: "assistant.stop" }), KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, shortcutOverrides)} onClick={onCancel}>{intl.formatMessage({ id: "assistant.stop" })}</Button>}
        </footer>
    </aside>;
}


function TimelineMessage({ message, openView }: { message: AssistantMessage; openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void }) {
    const intl = useIntl();
    const label = message.responseKind ? intl.formatMessage({ id: responseMessages[message.responseKind] }, message.skillId ? { skill: intl.formatMessage({ id: skillMessages[message.skillId] }) } : {}) : message.skillId ? intl.formatMessage({ id: skillMessages[message.skillId] }) : message.role === "author" ? intl.formatMessage({ id: "assistant.authorMessage" }) : intl.formatMessage({ id: "assistant.heading" });
    const content = message.template === "greeting" ? intl.formatMessage({ id: "assistant.greeting" }) : message.template === "request_cancelled" ? intl.formatMessage({ id: "assistant.requestCancelled" }) : message.template === "request_failed" ? intl.formatMessage({ id: "assistant.requestFailed" }) : message.content;
    const view = message.responseKind === "findings_prepared" ? "fact-check" : message.responseKind === "translation_proposal_prepared" ? "translations" : message.responseKind === "proposal_and_findings_prepared" ? "style-profile" : message.responseKind === "proposal_prepared" ? "proposal" : undefined;

    return <article className="rounded-panel border border-border bg-surface-raised p-3">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {content && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{content}</p>}
        <time className="mt-2 block text-xs text-muted">{new Date(message.createdAt).toLocaleString()}</time>
        {view && <Button className="mt-2" variant="secondary" onClick={() => openView?.(view)}>
            {intl.formatMessage({ id: view === "fact-check" || view === "style-profile" ? "assistant.viewFindings" : view === "translations" ? "assistant.reviewTranslation" : "assistant.reviewProposal" })}
        </Button>}
    </article>;
}
