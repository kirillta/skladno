import { useRef } from "react";
import type { TextProposal } from "@skladno/shared";
import { Banner, Button, Diff, EmptyState, IconButton, Status } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { presentProposalReview, type ProposalDecision } from "./proposal-review-presentation.js";
import { AssistantIcon, ChevronRightIcon, CloseIcon } from "../../ui/icons.js";


export function ProposalReviewView({ review, stale, decisions, summaries, summaryState, setDecision, acceptAll, applyAccepted, rejectAll, dismissProposal, warningsDismissed, dismissWarnings, openWrite, openAssistant }: {
    review: TextProposal | undefined;
    stale: boolean;
    decisions: Record<string, ProposalDecision>;
    summaries?: Record<string, string>;
    summaryState?: "idle" | "loading" | "unavailable";
    setDecision: (id: string, decision: ProposalDecision) => void;
    acceptAll: () => Promise<void>;
    applyAccepted: () => Promise<void>;
    rejectAll: () => void;
    dismissProposal: () => void;
    warningsDismissed: boolean;
    dismissWarnings: () => void;
    openWrite: () => void;
    openAssistant: () => void;
}) {
    const intl = useIntl();
    const cards = useRef<(HTMLElement | null)[]>([]);

    function moveChange(direction: -1 | 1) {
        const current = cards.current.findIndex((card) => card === document.activeElement);
        const index = current < 0 ? 0 : (current + direction + cards.current.length) % cards.current.length;

        cards.current[index]?.focus();
    }

    if (!review)
        return <EmptyState title={intl.formatMessage({ id: "views.proposalEmptyTitle" })}>{intl.formatMessage({ id: "views.proposalEmpty" })}</EmptyState>;

    const presentation = presentProposalReview(review);
    const counts = presentation.changes.reduce((result, change) => ({ ...result, [decisions[change.id] ?? "pending"]: result[decisions[change.id] ?? "pending"] + 1 }), { pending: 0, accepted: 0, rejected: 0 });
    const acceptanceBlocked = stale || !presentation.reliable;
    const allResolved = counts.pending === 0 && presentation.changes.length > 0;

    return <div className="mx-auto w-full max-w-6xl pb-6">
        {stale && <Banner className="mb-4" tone="warning"><div><p>{intl.formatMessage({ id: "views.proposalStale" })}</p><div className="mt-2 flex gap-2"><Button variant="secondary" onClick={openWrite}>{intl.formatMessage({ id: "views.reviewCurrentArticle" })}</Button><Button variant="secondary" onClick={openAssistant}>{intl.formatMessage({ id: "views.regenerateInAssistant" })}</Button><Button variant="secondary" onClick={dismissProposal}>{intl.formatMessage({ id: "views.dismissProposal" })}</Button></div></div></Banner>}
        {presentation.warnings.length > 0 && !warningsDismissed && <div className="relative mb-4"><Status label={intl.formatMessage({ id: "views.preservationWarnings" })} tone="warning"><ul className="mt-1 list-disc pl-4 pr-8">{presentation.warnings.map((warning) => <li key={warning}>{intl.formatMessage({ id: `views.warning.${warning}` as never })}</li>)}</ul></Status><IconButton className="absolute right-2 top-2" label={intl.formatMessage({ id: "views.dismissPreservationWarnings" })} onClick={dismissWarnings}><CloseIcon className="size-4" /></IconButton></div>}
        <header className="-mx-5 border-b border-border bg-canvas px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-semibold">{intl.formatMessage({ id: "views.proposalReview" })}</h2>
                    <p className="mt-1 text-xs text-muted">{stale || !presentation.reliable
                        ? intl.formatMessage({ id: "views.proposalWhole" }, { changes: presentation.changes.length })
                        : intl.formatMessage({ id: "views.proposalCounts" }, { total: presentation.changes.length, pending: counts.pending, accepted: counts.accepted, rejected: counts.rejected })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {presentation.changes.length > 1 && <nav className="flex gap-2" aria-label={intl.formatMessage({ id: "views.changeNavigation" })}>
                        <Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "views.previousChange" })} title={intl.formatMessage({ id: "views.previousChange" })} onClick={() => moveChange(-1)}><ChevronRightIcon className="size-4 rotate-180" /></Button>
                        <Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "views.nextChange" })} title={intl.formatMessage({ id: "views.nextChange" })} onClick={() => moveChange(1)}><ChevronRightIcon className="size-4" /></Button>
                    </nav>}
                    <Button variant="secondary" disabled={stale || presentation.changes.length === 0} onClick={rejectAll}>{intl.formatMessage({ id: "views.rejectAll" })}</Button>
                    <Button variant="secondary" disabled={stale || presentation.changes.length === 0} onClick={() => void acceptAll()}>{intl.formatMessage({ id: "views.acceptAll" })}</Button>
                    <Button disabled={acceptanceBlocked || !allResolved || counts.accepted === 0} onClick={() => void applyAccepted()}>{intl.formatMessage({ id: "views.applyAccepted" })}</Button>
                </div>
            </div>
        </header>
        {(!presentation.reliable || stale) && <div className="mt-4">{!presentation.reliable && <Banner className="mb-3" tone="warning">{intl.formatMessage({ id: "views.proposalFallback" })}</Banner>}<Diff layout="columns" removed={review.baseContent} added={review.proposedContent} /></div>}
        {presentation.changes.length === 0 ? <EmptyState title={intl.formatMessage({ id: "views.proposalNoChanges" })}><Button variant="secondary" onClick={dismissProposal}>{intl.formatMessage({ id: "views.dismissProposal" })}</Button></EmptyState> : presentation.reliable && !stale && <div className="mt-4 space-y-4">{presentation.changes.map((change, index) => {
            const decision = decisions[change.id] ?? "pending";
            const decisionClasses = decision === "accepted" ? "border-success bg-success-soft" : decision === "rejected" ? "border-danger bg-danger-soft" : "border-border bg-surface-raised";
            return <article key={change.id} ref={(element) => {
                cards.current[index] = element;
            }} tabIndex={-1} className={`rounded-panel border p-4 ${decisionClasses}`}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{intl.formatMessage({ id: `views.changeType.${change.kind}` as never }, { index: index + 1, total: presentation.changes.length })}</h3><p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: `views.decision.${decision}` as never })}</p></div><div className="flex gap-2"><Button variant="secondary" state={decision === "rejected" ? "error" : "default"} disabled={stale} onClick={() => setDecision(change.id, "rejected")}>{intl.formatMessage({ id: "views.rejectChange" })}</Button><Button state={decision === "accepted" ? "success" : "default"} disabled={stale} onClick={() => setDecision(change.id, "accepted")}>{intl.formatMessage({ id: "views.acceptChange" })}</Button></div></div>
                <div className="mt-4 flex min-h-9 items-start gap-2 border-y border-border py-3 text-sm" aria-live="polite">
                    <AssistantIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                    <p>{summaries?.[change.id] ?? (summaryState === "loading" ? intl.formatMessage({ id: "views.proposalSummaryLoading" }) : intl.formatMessage({ id: "views.proposalSummaryUnavailable" }))}</p>
                </div>
                <div className="mt-4"><Diff layout="columns" state={decision} removed={change.baseLines.join("\n")} added={change.proposalLines.join("\n")} /></div>
            </article>;
        })}</div>}
    </div>;
}
