import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { BUILT_IN_SKILL, KEY_BINDING_COMMAND, builtInSkillScopeCompatibility, builtInSkills, defaultGeneralSettings, type Article, type AssistantMessage, type BuiltInSkillId, type FactCheckClaimPreview, type GeneralSettings, type KeyBindingOverrides, type UpdateArticleInput } from "@skladno/shared";
import { Button } from "../../ui/primitives.js";
import { AssistantIcon, ChevronRightIcon } from "../../ui/icons.js";
import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";
import { AssistantComposer } from "./assistant/AssistantComposer.js";
import { AssistantTimeline } from "./assistant/AssistantTimeline.js";
import { composerCaretOffset, composerText, placeCaretAfterSkill, textBeforeSkill } from "./assistant/composer-utils.js";
import { selectionPreview, skillMessages } from "./assistant/assistant-messages.js";


export function EditorialAssistantPanel({ state, message, errorDetails, factCheckClaims, onRequest, onCancel, collapsed, setCollapsed, translationLanguages = [], assistantMessages, dispatcher, shortcutOverrides, openView, selection, clearSelection, generalSettings = defaultGeneralSettings }: {
    state: "idle" | "streaming" | "error";
    message: string;
    errorDetails?: string;
    factCheckClaims?: FactCheckClaimPreview[];
    onRequest: (authorMessage: string, skillId?: BuiltInSkillId, language?: string | readonly string[], skillOffset?: number) => Promise<void>;
    onCancel: () => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    language?: string;
    translationLanguages?: readonly string[];
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
    const [composerOffset, setComposerOffset] = useState(0);
    const [activeSkillIndex, setActiveSkillIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const composer = useRef<HTMLDivElement>(null);
    const composerState = useRef({
        guidance,
        selectedSkill,
        skillOffset,
    });
    const canSend = state !== "streaming" && Boolean(guidance.trim() || selectedSkill) && (selectedSkill !== BUILT_IN_SKILL.TRANSLATION || translationLanguages.length > 0);
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
            selectionChip.className = "mx-1 inline-flex h-5 min-h-0 max-w-[calc(100%-0.5rem)] items-center gap-1 align-middle rounded-full border border-border bg-surface px-1.5 text-xs font-semibold text-muted";
            selectionChip.ariaLabel = intl.formatMessage({ id: "assistant.articleSelection" });
            selectionChip.title = selection;

            const preview = document.createElement("span");
            preview.className = "relative -top-px max-w-48 truncate";
            preview.append(selectionPreview(selection));
            selectionChip.append(preview);

            const clearButton = document.createElement("button");
            clearButton.type = "button";
            clearButton.className = "inline-grid size-3 min-h-0 place-items-center rounded-full p-0 text-muted hover:bg-surface-supporting";
            clearButton.ariaLabel = intl.formatMessage({ id: "assistant.clearArticleSelection" });
            clearButton.textContent = "×";

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
            clearButton.replaceChildren(closeIcon);
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
        const insertionOffset = selectedSkill ? skillOffset : slashTriggerOffset ?? composerOffset;
        const slashOffset = guidance[insertionOffset - 1] === "/" ? insertionOffset - 1 : undefined;
        const beforeSkill = guidance.slice(0, slashOffset ?? insertionOffset);
        const afterSkill = guidance.slice(insertionOffset);
        const skillOffsetAfterSpace = beforeSkill.endsWith(" ") ? beforeSkill.length - 1 : beforeSkill.length;
        const nextGuidance = `${beforeSkill.slice(0, skillOffsetAfterSpace)}${afterSkill.startsWith(" ") ? "" : " "}${afterSkill}`;
        setQuickActionsOpen(false);
        setSelectedSkill(skill);
        setSkillOffset(skillOffsetAfterSpace);
        setSlashTriggerOffset(undefined);
        setGuidance(nextGuidance);
        renderComposerContent(nextGuidance, skill, skillOffsetAfterSpace);
        composer.current?.focus();
        if (composer.current)
            placeCaretAfterSkill(composer.current);
    }, [composerOffset, guidance, renderComposerContent, selectedSkill, skillOffset, slashTriggerOffset]);

    const send = useCallback(() => {
        if (!canSend)
            return;

        const authorMessage = guidance.trim();
        const leadingWhitespace = guidance.length - guidance.trimStart().length;
        const requestSkill = selectedSkill && (!selection || builtInSkillScopeCompatibility[selectedSkill].includes("selection")) ? selectedSkill : undefined;
        const selectedSkillOffset = requestSkill ? Math.max(0, skillOffset - leadingWhitespace) : undefined;

        void onRequest(authorMessage, requestSkill, requestSkill === BUILT_IN_SKILL.TRANSLATION ? translationLanguages : undefined, selectedSkillOffset)
            .then(() => {
                setGuidance("");
                setSelectedSkill(undefined);
                renderComposerContent("");
            });
    }, [canSend, guidance, onRequest, renderComposerContent, selectedSkill, selection, skillOffset, translationLanguages]);

    useEffect(() => {
        const unregisterSend = dispatcher?.register(KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, send);
        const unregisterStop = dispatcher?.register(KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, onCancel);
        return () => {
            unregisterSend?.();
            unregisterStop?.();
        };
    }, [dispatcher, onCancel, send]);

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

    useEffect(() => {
        if (!selectedSkill || !selection || builtInSkillScopeCompatibility[selectedSkill].includes("selection"))
            return;

        setSelectedSkill(undefined);
        setSkillOffset(0);
        renderComposerContent(guidance);
    }, [guidance, renderComposerContent, selectedSkill, selection]);

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedDuration = elapsedMinutes > 0
        ? intl.formatMessage({ id: "assistant.duration.minutesAndSeconds" }, { minutes: elapsedMinutes, seconds: elapsedSeconds % 60 })
        : intl.formatMessage({ id: "assistant.duration.seconds" }, { seconds: elapsedSeconds });

    if (collapsed)
        return <aside data-workspace-panel="editorial-assistant" className="flex h-full w-full flex-col border-l border-border bg-surface-supporting p-1" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
            <header className="flex min-h-18 w-full items-center justify-center"><Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.expand" })} onClick={() => setCollapsed(false)}><AssistantIcon className="size-5 text-brand" /></Button></header>
        </aside>;

    return <aside data-workspace-panel="editorial-assistant" className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
        <header className="flex min-h-18 items-center border-b border-border px-5">
            <AssistantIcon className="size-5 shrink-0 text-brand" />
            <h2 className="ml-3 text-base font-semibold">{intl.formatMessage({ id: "assistant.heading" })}</h2>
            <Button className="ml-auto inline-grid size-9 place-items-center p-1" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.collapse" }), KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}>
                <ChevronRightIcon className="size-3" />
            </Button>
        </header>
        <AssistantTimeline state={state} message={message} errorDetails={errorDetails} factCheckClaims={factCheckClaims} collapsed={collapsed} assistantMessages={assistantMessages} openView={openView} generalSettings={generalSettings} elapsedDuration={elapsedDuration} />
        <AssistantComposer
            state={state}
            canSend={canSend}
            guidance={guidance}
            selectedSkill={selectedSkill}
            selection={selection}
            composer={composer}
            quickActionsOpen={quickActionsOpen}
            availableSkills={availableSkills}
            setQuickActionsOpen={setQuickActionsOpen}
            setActiveSkillIndex={setActiveSkillIndex}
            selectSkill={selectSkill}
            focusQuickAction={focusQuickAction}
            send={send}
            onCancel={onCancel}
            onInput={(event) => {
                const element = event.currentTarget;
                const text = composerText(element);
                const caretOffset = composerCaretOffset(element);
                const currentComposerOffset = caretOffset === 0 && text.length > 0 ? text.length : caretOffset;
                setGuidance(text);
                setComposerOffset(currentComposerOffset);
                if (selectedSkill)
                    setSkillOffset(textBeforeSkill(element));

                if (text[currentComposerOffset - 1] === "/" || text.endsWith("/")) {
                    setQuickActionsOpen(true);
                    setActiveSkillIndex(-1);
                    setSlashTriggerOffset(text[currentComposerOffset - 1] === "/" ? currentComposerOffset : text.length);
                }
            }}
            onKeyDown={(event) => {
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
            }}
            shortcutOverrides={shortcutOverrides} />
    </aside>;
}
