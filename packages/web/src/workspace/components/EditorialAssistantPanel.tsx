import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { BUILT_IN_SKILL, KEY_BINDING_COMMAND, builtInSkillScopeCompatibility, builtInSkills, defaultGeneralSettings, type Article, type AssistantMessage, type AssistantResponseKind, type BuiltInSkillId, type GeneralSettings, type KeyBindingOverrides, type UpdateArticleInput } from "@skladno/shared";
import { Banner, Button } from "../../ui/primitives.js";
import { AssistantIcon, ChevronDownIcon, ChevronRightIcon, SendIcon, StopIcon } from "../../ui/icons.js";
import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import { formatDateTime } from "../../i18n/formatting.js";

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


function isComposerDecoration(node: Node): boolean {
    return node instanceof HTMLElement && node.dataset.assistantComposerDecoration !== undefined;
}


function textBeforeSkill(composer: HTMLDivElement): number {
    let length = 0;
    for (const node of composer.childNodes) {
        if (node instanceof HTMLElement && node.dataset.assistantSkillChip !== undefined)
            return length;

        if (!isComposerDecoration(node))
            length += node.textContent?.length ?? 0;
    }

    return length;
}


function composerText(composer: HTMLDivElement): string {
    return [...composer.childNodes]
        .filter((node) => !isComposerDecoration(node))
        .map((node) => node.textContent ?? "")
        .join("");
}


function composerCaretOffset(composer: HTMLDivElement): number {
    const selection = window.getSelection();
    if (!selection?.rangeCount)
        return composerText(composer).length;

    const range = selection.getRangeAt(0);
    const beforeCaret = range.cloneRange();
    beforeCaret.selectNodeContents(composer);
    beforeCaret.setEnd(range.endContainer, range.endOffset);
    const walker = document.createTreeWalker(composer, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let node = walker.nextNode();

    while (node) {
        if (!node.parentElement?.closest("[data-assistant-composer-decoration]")) {
            if (beforeCaret.comparePoint(node, node.textContent?.length ?? 0) !== 1)
                offset += node.textContent?.length ?? 0;
            else if (node === range.endContainer)
                offset += range.endOffset;
        }

        node = walker.nextNode();
    }

    return offset;
}


function placeCaretAfterSkill(composer: HTMLDivElement): void {
    const skill = composer.querySelector<HTMLElement>("[data-assistant-skill-chip]");
    if (!skill)
        return;

    const range = document.createRange();
    range.setStartAfter(skill);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}


export function EditorialAssistantPanel({ state, message, onRequest, onCancel, collapsed, setCollapsed, language, assistantMessages, dispatcher, shortcutOverrides, openView, selection, clearSelection, generalSettings = defaultGeneralSettings }: {
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
    selection?: string;
    clearSelection?: () => void;
    generalSettings?: GeneralSettings;
}) {
    const intl = useIntl();
    const [guidance, setGuidance] = useState("");
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<BuiltInSkillId>();
    const [skillOffset, setSkillOffset] = useState(0);
    const [slashTriggerOffset, setSlashTriggerOffset] = useState<number>();
    const [activeSkillIndex, setActiveSkillIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const timeline = useRef<HTMLDivElement>(null);
    const composer = useRef<HTMLDivElement>(null);
    const composerState = useRef({
        guidance,
        selectedSkill,
        skillOffset,
    });
    const greeting = assistantMessages?.find((item) => item.template === "greeting" || item.kind === "greeting");
    const canSend = state !== "streaming" && Boolean(guidance.trim());
    const availableSkills = builtInSkills.filter((skill) => !selection || builtInSkillScopeCompatibility[skill].includes("selection"));

    composerState.current = {
        guidance,
        selectedSkill,
        skillOffset,
    };

    const renderComposerContent = useCallback((value: string, skill?: BuiltInSkillId, offset = 0) => {
        const element = composer.current;
        if (!element)
            return;

        element.replaceChildren();

        if (selection) {
            const selectionChip = document.createElement("span");
            selectionChip.dataset.assistantComposerDecoration = "";
            selectionChip.contentEditable = "false";
            selectionChip.className = "mx-1 inline-flex h-8 min-h-0 items-center gap-1 align-middle rounded-control border border-border bg-surface px-2 py-1 text-xs font-semibold text-muted";
            selectionChip.append(intl.formatMessage({ id: "assistant.articleSelection" }));

            const clearButton = document.createElement("button");
            clearButton.type = "button";
            clearButton.className = "inline-grid size-5 min-h-0 place-items-center rounded-control p-0 text-muted hover:bg-surface-supporting";
            clearButton.ariaLabel = intl.formatMessage({ id: "assistant.clearArticleSelection" });
            clearButton.textContent = "×";
            clearButton.addEventListener("mousedown", (event) => event.preventDefault());
            clearButton.addEventListener("click", () => clearSelection?.());
            selectionChip.append(clearButton);
            element.append(selectionChip);
        }

        element.append(value.slice(0, offset));

        if (skill) {
            const skillChip = document.createElement("span");
            skillChip.dataset.assistantComposerDecoration = "";
            skillChip.dataset.assistantSkillChip = "";
            skillChip.contentEditable = "false";
            skillChip.className = "mx-1 inline-flex h-5 min-h-0 max-w-[calc(100%-0.5rem)] items-center gap-1 align-middle rounded-full border border-brand/45 bg-brand-soft px-1.5 text-xs font-semibold text-brand";
            const skillLabel = intl.formatMessage({ id: skillMessages[skill] });
            skillChip.ariaLabel = intl.formatMessage({ id: "assistant.selectedSkill" }, { skill: skillLabel });
            const skillLabelElement = document.createElement("span");
            skillLabelElement.className = "relative -top-px";
            skillLabelElement.append(skillLabel);
            skillChip.append(skillLabelElement);

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "inline-grid size-3 min-h-0 place-items-center rounded-full p-0 text-brand/70 hover:bg-brand-soft hover:text-brand";
            removeButton.ariaLabel = intl.formatMessage({ id: "assistant.removeSkill" }, { skill: skillLabel });
            const closeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            closeIcon.setAttribute("viewBox", "0 0 16 16");
            closeIcon.setAttribute("fill", "none");
            closeIcon.setAttribute("aria-hidden", "true");
            closeIcon.classList.add("size-3");
            const closePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            closePath.setAttribute("d", "m4 4 8 8m0-8-8 8");
            closePath.setAttribute("stroke", "currentColor");
            closePath.setAttribute("stroke-linecap", "round");
            closePath.setAttribute("stroke-width", "1.5");
            closeIcon.append(closePath);
            removeButton.append(closeIcon);
            removeButton.addEventListener("mousedown", (event) => event.preventDefault());
            removeButton.addEventListener("click", () => {
                renderComposerContent(value);
                setSelectedSkill(undefined);
                composer.current?.focus();
            });
            skillChip.append(removeButton);
            element.append(skillChip);
        }

        element.append(value.slice(offset));
    }, [clearSelection, intl, selection]);

    function focusQuickAction(index: number) {
        const nextIndex = (index + availableSkills.length) % availableSkills.length;
        setActiveSkillIndex(nextIndex);
        document.querySelectorAll<HTMLButtonElement>("[data-assistant-skill]")[nextIndex]?.focus();
    }

    const selectSkill = useCallback((skill: BuiltInSkillId) => {
        const insertionOffset = selectedSkill ? skillOffset : slashTriggerOffset ?? (composer.current ? composerCaretOffset(composer.current) : guidance.length);
        const slashOffset = guidance[insertionOffset - 1] === "/" ? insertionOffset - 1 : undefined;
        const nextGuidance = slashOffset === undefined ? guidance : `${guidance.slice(0, slashOffset)}${guidance.slice(insertionOffset)}`;
        setQuickActionsOpen(false);
        setSelectedSkill(skill);
        setSkillOffset(slashOffset ?? insertionOffset);
        setSlashTriggerOffset(undefined);
        setGuidance(nextGuidance);
        renderComposerContent(nextGuidance, skill, slashOffset ?? insertionOffset);
        composer.current?.focus();
        if (composer.current)
            placeCaretAfterSkill(composer.current);
    }, [guidance, renderComposerContent, selectedSkill, skillOffset, slashTriggerOffset]);

    const send = useCallback(() => {
        if (!canSend)
            return;

        void onRequest(guidance.trim(), selectedSkill, selectedSkill === BUILT_IN_SKILL.TRANSLATION ? language : undefined)
            .then(() => {
                setGuidance("");
                setSelectedSkill(undefined);
                renderComposerContent("");
            });
    }, [canSend, guidance, language, onRequest, renderComposerContent, selectedSkill]);

    useEffect(() => {
        const unregisterSend = dispatcher?.register(KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, send);
        const unregisterStop = dispatcher?.register(KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, onCancel);
        return () => {
            unregisterSend?.();
            unregisterStop?.();
        };
    }, [dispatcher, onCancel, send]);

    useEffect(() => {
        const element = timeline.current;
        if (!element)
            return;

        element.scrollTop = element.scrollHeight;
    }, [assistantMessages, state]);

    useEffect(() => {
        if (state !== "streaming") {
            setElapsedSeconds(0);
            return;
        }

        const startedAt = Date.now();
        const interval = window.setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
        }, 1_000);

        return () => window.clearInterval(interval);
    }, [state]);

    useEffect(() => {
        const currentState = composerState.current;
        renderComposerContent(currentState.guidance, currentState.selectedSkill, currentState.skillOffset);
    }, [renderComposerContent]);

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedDuration = elapsedMinutes > 0
        ? intl.formatMessage({ id: "assistant.duration.minutesAndSeconds" }, { minutes: elapsedMinutes, seconds: elapsedSeconds % 60 })
        : intl.formatMessage({ id: "assistant.duration.seconds" }, { seconds: elapsedSeconds });

    if (collapsed)
        return <aside data-workspace-panel="editorial-assistant" className="flex h-full w-full flex-col border-l border-border bg-surface-supporting p-1" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
            <header className="flex min-h-18 w-full items-center justify-center"><Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.expand" })} onClick={() => setCollapsed(false)}><AssistantIcon className="size-5 text-brand" /></Button></header>
        </aside>;

    return <aside data-workspace-panel="editorial-assistant" className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
        <header className="flex min-h-18 items-center border-b border-border px-5"><AssistantIcon className="size-5 shrink-0 text-brand" /><h2 className="ml-3 text-base font-semibold">{intl.formatMessage({ id: "assistant.heading" })}</h2><Button className="ml-auto inline-grid size-9 place-items-center p-1" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.collapse" }), KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}><ChevronRightIcon className="size-3" /></Button></header>
        <div ref={timeline} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" aria-live="polite">
            {greeting && <TimelineMessage message={greeting} generalSettings={generalSettings} />}
            {assistantMessages?.filter((item) => item !== greeting).map((item) => <TimelineMessage key={item.id} message={item} openView={openView} generalSettings={generalSettings} />)}
            {!assistantMessages?.length && <p className="text-sm leading-6 text-muted">{intl.formatMessage({ id: "assistant.intro" })}</p>}
            {state === "streaming" && <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted" role="status">
                <span className="flex gap-1" aria-hidden="true">
                    <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
                    <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none [animation-delay:150ms]" />
                    <span className="size-1 rounded-full bg-muted animate-pulse motion-reduce:animate-none [animation-delay:300ms]" />
                </span>
                <span>{intl.formatMessage({ id: "assistant.workingFor" }, { duration: elapsedDuration })}</span>
            </div>}
            {message && <Banner tone="error" role="alert">{message}</Banner>}
        </div>
        <footer className="shrink-0 border-t border-border px-5 py-4">
            <div className="relative mb-3">
                {quickActionsOpen && <div className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-panel border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "assistant.quickActions" })}>
                    {availableSkills.map((skill, index) => <Button data-assistant-skill className="flex w-full justify-start text-xs" key={skill} disabled={state === "streaming"} variant="quiet" onClick={() => selectSkill(skill)} onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            focusQuickAction(index + 1);
                        }

                        if (event.key === "ArrowUp") {
                            event.preventDefault();
                            focusQuickAction(index - 1);
                        }

                        if (event.key === "Escape") {
                            event.preventDefault();
                            setQuickActionsOpen(false);
                            composer.current?.focus();
                        }
                    }}>{intl.formatMessage({ id: skillMessages[skill] })}</Button>)}
                </div>}
                <Button className="flex items-center gap-2" variant="secondary" aria-expanded={quickActionsOpen} onClick={() => setQuickActionsOpen((open) => {
                    if (!open)
                        setActiveSkillIndex(0);

                    return !open;
                })}>{intl.formatMessage({ id: "assistant.quickActions" })}<ChevronDownIcon className={`size-4 ${quickActionsOpen ? "rotate-180" : ""}`} /></Button>
            </div>
            <div className="relative min-h-25 rounded-control border border-border bg-surface-raised px-3 py-2"><div ref={composer} data-assistant-composer data-placeholder={!guidance && !selectedSkill && !selection ? intl.formatMessage({ id: "assistant.guidancePlaceholder" }) : undefined} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={intl.formatMessage({ id: "assistant.guidance" })} className="min-h-20 whitespace-pre-wrap pr-10 text-sm leading-5 text-ink outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-ink/45" onInput={(event) => {
                const element = event.currentTarget;
                const text = composerText(element);
                const caretOffset = composerCaretOffset(element);
                setGuidance(text);
                if (selectedSkill)
                    setSkillOffset(textBeforeSkill(element));

                if (text[caretOffset - 1] === "/" || text.endsWith("/")) {
                    setQuickActionsOpen(true);
                    setActiveSkillIndex(-1);
                    setSlashTriggerOffset(text[caretOffset - 1] === "/" ? caretOffset : text.length);
                }
            }} onKeyDown={(event) => {
                if (!quickActionsOpen)
                    return;

                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusQuickAction(activeSkillIndex + 1);
                }

                if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusQuickAction(activeSkillIndex - 1);
                }

                if (event.key === "Escape") {
                    event.preventDefault();
                    setQuickActionsOpen(false);
                }
            }} />
                {state === "streaming"
                    ? <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center !p-0" variant="danger" title={shortcutHint(intl.formatMessage({ id: "assistant.stop" }), KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.stop" })} onClick={onCancel}><StopIcon className="size-4" /></Button>
                    : <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center !p-0" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.send" }), KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={!canSend} onClick={send}><SendIcon className="size-4" /></Button>}
            </div>
        </footer>
    </aside>;
}


function TimelineMessage({ message, openView, generalSettings }: { message: AssistantMessage; openView?: (view: "proposal" | "fact-check" | "style-profile" | "translations") => void; generalSettings: GeneralSettings }) {
    const intl = useIntl();
    const authorMessage = message.role === "author";
    const label = message.responseKind ? intl.formatMessage({ id: responseMessages[message.responseKind] }, message.skillId ? { skill: intl.formatMessage({ id: skillMessages[message.skillId] }) } : {}) : message.skillId ? intl.formatMessage({ id: skillMessages[message.skillId] }) : message.role === "author" ? intl.formatMessage({ id: "assistant.authorMessage" }) : intl.formatMessage({ id: "assistant.heading" });
    const content = message.template === "greeting" ? intl.formatMessage({ id: "assistant.greeting" }) : message.template === "request_cancelled" ? intl.formatMessage({ id: "assistant.requestCancelled" }) : message.template === "request_failed" ? intl.formatMessage({ id: "assistant.requestFailed" }) : message.content;
    const view = message.responseKind === "findings_prepared" ? "fact-check" : message.responseKind === "translation_proposal_prepared" ? "translations" : message.responseKind === "proposal_and_findings_prepared" ? "style-profile" : message.responseKind === "proposal_prepared" ? "proposal" : undefined;

    return <article className={`rounded-panel border p-3 ${authorMessage ? "ml-6 border-brand/45 bg-brand-soft" : "mr-6 border-border bg-surface-raised"}`} aria-label={authorMessage ? label : undefined}>
        {!authorMessage && <p className="text-xs font-semibold text-muted">{label}</p>}
        {content && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{content}</p>}
        <time className="mt-2 block text-xs text-muted">{formatDateTime(message.createdAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, generalSettings.timeZone)}</time>
        {view && <Button className="mt-2" variant="secondary" onClick={() => openView?.(view)}>
            {intl.formatMessage({ id: view === "fact-check" || view === "style-profile" ? "assistant.viewFindings" : view === "translations" ? "assistant.reviewTranslation" : "assistant.reviewProposal" })}
        </Button>}
    </article>;
}
