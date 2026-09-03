import type { RefObject } from "react";
import { useIntl } from "react-intl";
import type { BuiltInSkillId } from "@skladno/shared";
import { Button } from "../../../ui/primitives.js";
import { ChevronDownIcon, CloseIcon } from "../../../ui/icons.js";
import type { AssistantSelectionScope } from "../../state/assistant-messages-state.js";
import { selectionPreview, skillMessages } from "./assistant-messages.js";
import type { AssistantSkillPickerControls } from "./assistant-composer-plugins.js";


export function AssistantQuickActions({ state, composer, quickActionsOpen, availableSkills, activeSkillIndex, setQuickActionsOpen, setActiveSkillIndex, selectSkill, focusQuickAction }: AssistantSkillPickerControls & { state: "idle" | "streaming" | "error"; composer: RefObject<HTMLDivElement>; setActiveSkillIndex: (value: number) => void }) {
    const intl = useIntl();
    return <div className="relative mb-3">
        {quickActionsOpen && <div id="assistant-skill-picker" className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-panel border border-border bg-surface-raised p-1 shadow-raised" role="listbox" aria-label={intl.formatMessage({ id: "assistant.quickActions" })}>
            {availableSkills.map((skill, index) => <SkillOption key={skill} skill={skill} index={index} state={state} activeSkillIndex={activeSkillIndex} selectSkill={selectSkill} focusQuickAction={focusQuickAction} setQuickActionsOpen={setQuickActionsOpen} composer={composer} />)}
        </div>}
        {quickActionsOpen && <span className="sr-only" aria-live="polite">{intl.formatMessage({ id: "assistant.skillResultCount" }, { count: availableSkills.length })}</span>}
        <Button className="flex items-center gap-2" variant="secondary" aria-expanded={quickActionsOpen} aria-controls="assistant-skill-picker" onClick={() => setQuickActionsOpen((open) => {
            if (!open)
                setActiveSkillIndex(0);

            return !open;
        })}>{intl.formatMessage({ id: "assistant.quickActions" })}<ChevronDownIcon className={`size-4 ${quickActionsOpen ? "rotate-180" : ""}`} /></Button>
    </div>;
}


function SkillOption({ skill, index, state, activeSkillIndex, selectSkill, focusQuickAction, setQuickActionsOpen, composer }: { skill: BuiltInSkillId; index: number; state: "idle" | "streaming" | "error"; activeSkillIndex: number; selectSkill: (skill: BuiltInSkillId) => void; focusQuickAction: (index: number) => void; setQuickActionsOpen: AssistantSkillPickerControls["setQuickActionsOpen"]; composer: RefObject<HTMLDivElement> }) {
    const intl = useIntl();
    return <Button data-assistant-skill className="flex w-full justify-start text-xs" id={`assistant-skill-option-${skill}`} role="option" aria-selected={index === activeSkillIndex} disabled={state === "streaming"} variant="quiet" onClick={() => selectSkill(skill)} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            selectSkill(skill);
        }

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
    }}>{intl.formatMessage({ id: skillMessages[skill] })}</Button>;
}


export function SelectionChip({ selection, clearSelection }: { selection?: AssistantSelectionScope; clearSelection?: () => void }) {
    const intl = useIntl();
    if (!selection)
        return null;

    return <span data-assistant-composer-decoration className="mx-1 inline-flex h-5 min-h-0 max-w-[calc(100%-0.5rem)] items-center gap-1 align-middle rounded-full border border-border bg-surface px-1.5 text-xs font-semibold text-muted" aria-label={intl.formatMessage({ id: "assistant.articleSelection" })} title={selection.preview}>
        <span className="relative -top-px max-w-48 truncate">{selectionPreview(selection.preview)}</span>
        <button type="button" className="inline-grid size-3 min-h-0 place-items-center rounded-full p-0 text-muted hover:bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.clearArticleSelection" })} onClick={clearSelection}><CloseIcon className="size-2" /></button>
    </span>;
}
