import { useId, useRef } from "react";
import { useIntl } from "react-intl";
import { ChevronDownIcon } from "../../ui/icons.js";
import { getProvenanceMessageId, getTimelineKind, timelineIcons } from "../views/revision-history-presentation.js";
import { handleStatusMenuKeyDown, openStatusMenu } from "./ArticleStatusBarMenu.js";
import type { RevisionSelector } from "./ArticleStatusBar.js";


export function RevisionStatusControl({ revisionNumber, revisionSelector, open, onToggle, onOpen, onClose }: { revisionNumber: number; revisionSelector?: RevisionSelector; open: boolean; onToggle: () => void; onOpen: () => void; onClose: () => void }) {
    const intl = useIntl();
    const trigger = useRef<HTMLButtonElement>(null);
    const menuId = useId();
    const availableRevisions = revisionSelector?.revisions ?? [];

    if (!revisionSelector)
        return <span className="font-normal text-muted">{intl.formatMessage({ id: "status.revision" }, { revisionNumber })}</span>;

    return <div className="relative shrink-0">
        <button data-focus-area-entry ref={trigger} className="inline-flex h-6 items-center gap-1 border-x border-border px-1.5 text-xs text-muted hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" type="button" aria-label={intl.formatMessage({ id: "status.revisionSelector" }, { revisionNumber })} aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" onClick={onToggle} onKeyDown={(event) => {
            if (event.key === "Escape")
                onClose();

            openStatusMenu(event, onOpen, menuId);
        }}>
            <span>{intl.formatMessage({ id: "status.revision" }, { revisionNumber })}</span>
            <ChevronDownIcon className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div className="absolute bottom-6 left-0 z-20 w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-control border border-border bg-surface-raised p-1 shadow-raised">
            <div id={menuId} role="menu" aria-label={intl.formatMessage({ id: "status.revisionMenu" })} onKeyDown={(event) => handleStatusMenuKeyDown(event, () => {
                onClose();
                trigger.current?.focus();
            })}>
                {[...availableRevisions].reverse().map((revision) => {
                    const itemRevisionNumber = availableRevisions.indexOf(revision) + 1;
                    const current = revision.id === revisionSelector.currentRevisionId;
                    const description = revision.description ?? intl.formatMessage({ id: getProvenanceMessageId(revision, availableRevisions) });
                    const kind = getTimelineKind(revision, availableRevisions);
                    const TimelineIcon = timelineIcons[kind];

                    return <button key={revision.id} className="flex min-h-9 w-full items-center gap-2 rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" type="button" role="menuitem" aria-label={[description, current ? intl.formatMessage({ id: "revisions.current" }) : undefined].filter(Boolean).join(", ")} onClick={() => {
                        if (!current) {
                            revisionSelector.selectForRestore(revision);
                            onClose();
                        }
                    }}>
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-brand" data-revision-timeline-icon={kind}>
                            <TimelineIcon className={kind === "ai" || kind === "restored" ? "size-3" : "size-4"} />
                        </span>
                        <span className="font-semibold">{intl.formatMessage({ id: "status.revision" }, { revisionNumber: itemRevisionNumber })}</span>
                        <span className="min-w-0 flex-1 truncate" title={description}>{description}</span>
                        {current && <span className="text-micro font-semibold text-muted">{intl.formatMessage({ id: "revisions.current" })}</span>}
                    </button>;
                })}
            </div>
        </div>}
    </div>;
}
