import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ChevronDownIcon } from "../../ui/icons.js";
import { Button } from "../../ui/primitives.js";
import { RevisionArticlePreview } from "../editor/RevisionArticlePreview.js";
import { getProvenanceMessageId } from "../views/revision-history-presentation.js";
import { handleStatusMenuKeyDown, openStatusMenu } from "./ArticleStatusBarMenu.js";
import type { RevisionSelector } from "./ArticleStatusBar.js";


export function RevisionStatusControl({ revisionNumber, revisionSelector, open, onToggle, onOpen, onClose }: { revisionNumber: number; revisionSelector?: RevisionSelector; open: boolean; onToggle: () => void; onOpen: () => void; onClose: () => void }) {
    const intl = useIntl();
    const [selectedRevisionId, setSelectedRevisionId] = useState(revisionSelector?.currentRevisionId);
    const trigger = useRef<HTMLButtonElement>(null);
    const menuId = useId();
    const availableRevisions = revisionSelector?.revisions ?? [];
    const selectedRevision = availableRevisions.find((revision) => revision.id === selectedRevisionId)
        ?? availableRevisions.find((revision) => revision.id === revisionSelector?.currentRevisionId);
    const selectedRevisionNumber = selectedRevision ? availableRevisions.indexOf(selectedRevision) + 1 : revisionNumber;

    useEffect(() => {
        setSelectedRevisionId(revisionSelector?.currentRevisionId);
    }, [revisionSelector?.currentRevisionId]);

    if (!revisionSelector)
        return <span className="font-normal text-muted">{intl.formatMessage({ id: "status.revision" }, { revisionNumber })}</span>;

    return <div className="relative shrink-0">
        <button data-focus-area-entry ref={trigger} className="inline-flex h-6 items-center gap-1 rounded-control px-1.5 text-xs text-muted hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" type="button" aria-label={intl.formatMessage({ id: "status.revisionSelector" }, { revisionNumber })} aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" onClick={onToggle} onKeyDown={(event) => {
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
                    const selected = revision.id === selectedRevision?.id;

                    return <button key={revision.id} className={`flex min-h-9 w-full items-center gap-2 rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selected ? "bg-brand-soft" : ""}`} type="button" role="menuitemradio" aria-checked={selected} aria-label={[intl.formatMessage({ id: "revisions.revision" }), intl.formatNumber(itemRevisionNumber), intl.formatMessage({ id: getProvenanceMessageId(revision) }), current ? intl.formatMessage({ id: "revisions.current" }) : undefined, selected ? intl.formatMessage({ id: "status.revisionSelected" }) : undefined].filter(Boolean).join(", ")} onClick={() => setSelectedRevisionId(revision.id)}>
                        <span className="font-semibold">{intl.formatMessage({ id: "status.revision" }, { revisionNumber: itemRevisionNumber })}</span>
                        <span className="min-w-0 flex-1 truncate">{intl.formatMessage({ id: getProvenanceMessageId(revision) })}</span>
                        {current && <span className="text-micro font-semibold text-muted">{intl.formatMessage({ id: "revisions.current" })}</span>}
                        {selected && <span className="text-micro font-semibold text-brand">{intl.formatMessage({ id: "status.revisionSelected" })}</span>}
                    </button>;
                })}
            </div>
            {selectedRevision && <section className="mt-1 border-t border-border px-2 pb-2 pt-3" aria-label={intl.formatMessage({ id: "status.revisionPreview" }, { revisionNumber: selectedRevisionNumber })}>
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-ink">{intl.formatMessage({ id: "status.revision" }, { revisionNumber: selectedRevisionNumber })}</span>
                    {selectedRevision.id === revisionSelector.currentRevisionId && <span className="text-muted">{intl.formatMessage({ id: "revisions.current" })}</span>}
                </div>
                <div className="mt-2 max-h-[50dvh] overflow-y-auto rounded-control border border-border bg-editor-surface p-3 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
                    <RevisionArticlePreview revisionId={selectedRevision.id} content={selectedRevision.content} />
                </div>
                {selectedRevision.id !== revisionSelector.currentRevisionId && <Button compact variant="secondary" className="mt-2" onClick={() => {
                    revisionSelector.selectForRestore(selectedRevision);
                    onClose();
                    trigger.current?.focus();
                }}>{intl.formatMessage({ id: "revisions.restore" })}</Button>}
            </section>}
        </div>}
    </div>;
}
