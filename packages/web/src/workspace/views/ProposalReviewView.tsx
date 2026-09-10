import { useRef, useState } from "react";
import type { TextProposal } from "@skladno/shared";
import { Banner, Button, Diff, EmptyState, IconButton, Status } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { presentProposalReview, type ProposalDecision } from "./proposal-review-presentation.js";
import { AlignedParagraphsIcon, AssistantIcon, ChevronRightIcon, CloseIcon, ListIcon, SideBySideIcon } from "../../ui/icons.js";


function highlightedText(original: string, proposed: string) {
    const originalTokens = original.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
    const proposedTokens = proposed.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
    // ponytail: quadratic per paragraph; replace with Myers diff if long paragraphs become slow.
    const matches = Array.from({ length: originalTokens.length + 1 }, () => Array<number>(proposedTokens.length + 1).fill(0));

    for (let originalIndex = originalTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
        for (let proposedIndex = proposedTokens.length - 1; proposedIndex >= 0; proposedIndex -= 1) {
            matches[originalIndex]![proposedIndex] = originalTokens[originalIndex] === proposedTokens[proposedIndex]
                ? matches[originalIndex + 1]![proposedIndex + 1]! + 1
                : Math.max(matches[originalIndex + 1]![proposedIndex]!, matches[originalIndex]![proposedIndex + 1]!);
        }
    }

    const originalParts: { changed: boolean; text: string }[] = [];
    const proposedParts: { changed: boolean; text: string }[] = [];
    let originalIndex = 0;
    let proposedIndex = 0;
    while (originalIndex < originalTokens.length || proposedIndex < proposedTokens.length) {
        const unchanged = originalIndex < originalTokens.length && originalTokens[originalIndex] === proposedTokens[proposedIndex];
        if (unchanged) {
            originalParts.push({ changed: false, text: originalTokens[originalIndex]! });
            proposedParts.push({ changed: false, text: proposedTokens[proposedIndex]! });
            originalIndex += 1;
            proposedIndex += 1;
        } else if (originalIndex < originalTokens.length && (proposedIndex === proposedTokens.length || matches[originalIndex + 1]![proposedIndex]! >= matches[originalIndex]![proposedIndex + 1]!)) {
            originalParts.push({ changed: true, text: originalTokens[originalIndex]! });
            originalIndex += 1;
        } else {
            proposedParts.push({ changed: true, text: proposedTokens[proposedIndex]! });
            proposedIndex += 1;
        }
    }

    return { original: originalParts, proposed: proposedParts };
}


function HighlightedText({ parts, tone }: { parts: { changed: boolean; text: string }[]; tone: "added" | "removed" }) {
    return parts.map((part, index) => part.changed
        ? <mark className={tone === "added" ? "bg-success text-on-brand" : "bg-danger text-on-brand"} key={index}>{part.text}</mark>
        : part.text);
}


function ProposalDiff({ original, proposed, layout, decision = "pending", highlight }: { original: string; proposed: string; layout: "columns" | "stacked"; decision?: ProposalDecision; highlight: boolean }) {
    const highlights = highlight ? highlightedText(original, proposed) : undefined;
    return <Diff layout={layout} state={decision}
        removed={highlights ? <HighlightedText parts={highlights.original} tone="removed" /> : original}
        added={highlights ? <HighlightedText parts={highlights.proposed} tone="added" /> : proposed} />;
}


export function ProposalReviewView({ review, accepted = false, stale, decisions, summaries, summaryState, setDecision, acceptAll, applyAccepted, rejectAll, dismissProposal, warningsDismissed, dismissWarnings, openWrite, openAssistant }: {
    review: TextProposal | undefined;
    accepted?: boolean;
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
    const [displayMode, setDisplayMode] = useState<"side-by-side" | "stacked">("side-by-side");
    const [highlightChanges, setHighlightChanges] = useState(false);


    function moveChange(direction: -1 | 1) {
        const current = cards.current.findIndex((card) => card === document.activeElement);
        const index = current < 0 ? 0 : (current + direction + cards.current.length) % cards.current.length;

        cards.current[index]?.focus();
    }


    if (!review)
        return <EmptyState title={intl.formatMessage({ id: "views.proposalEmptyTitle" })}>{intl.formatMessage({ id: "views.proposalEmpty" })}</EmptyState>;

    const presentation = presentProposalReview(review);
    const counts = presentation.changes.reduce((result, change) => ({ ...result, [decisions[change.id] ?? "pending"]: result[decisions[change.id] ?? "pending"] + 1 }), { pending: 0, accepted: 0, rejected: 0 });
    const acceptanceBlocked = accepted || stale || !presentation.reliable;
    const allResolved = counts.pending === 0 && presentation.changes.length > 0;

    return <div className="mx-auto w-full max-w-6xl pb-6">
        {accepted && <Status className="mb-4" label={intl.formatMessage({ id: "views.proposalAccepted" })} tone="success" />}
        {stale && <Banner className="mb-4" tone="warning">
            <div>
                <p>{intl.formatMessage({ id: "views.proposalStale" })}</p>
                <div className="mt-2 flex gap-2">
                    <Button variant="secondary" onClick={openWrite}>{intl.formatMessage({ id: "views.reviewCurrentArticle" })}</Button>
                    <Button variant="secondary" onClick={openAssistant}>{intl.formatMessage({ id: "views.regenerateInAssistant" })}</Button>
                    <Button variant="secondary" onClick={dismissProposal}>{intl.formatMessage({ id: "views.dismissProposal" })}</Button>
                </div>
            </div>
        </Banner>
        }
        {presentation.warnings.length > 0 && !warningsDismissed
            && <div className="relative mb-4">
                <Status label={intl.formatMessage({ id: "views.preservationWarnings" })} tone="warning">
                    <ul className="mt-1 list-disc pl-4 pr-8">{presentation.warnings.map((warning) => <li key={warning}>{intl.formatMessage({ id: `views.warning.${warning}` as never })}</li>)}</ul>
                </Status>
                <IconButton className="absolute right-2 top-2" label={intl.formatMessage({ id: "views.dismissPreservationWarnings" })} onClick={dismissWarnings}>
                    <CloseIcon className="size-4" />
                </IconButton>
            </div>
        }
        <header className="-mx-5 border-b border-border bg-canvas px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.proposalReview" })}</h2>
                    <p className="mt-1 text-xs text-muted">{stale || !presentation.reliable
                        ? intl.formatMessage({ id: "views.proposalWhole" }, { changes: presentation.changes.length })
                        : intl.formatMessage({ id: "views.proposalCounts" }, { total: presentation.changes.length, pending: counts.pending, accepted: counts.accepted, rejected: counts.rejected })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {presentation.changes.length > 0 && <div className="flex items-center gap-1" aria-label={intl.formatMessage({ id: "views.proposalDisplayMode" })}>
                        <IconButton className={displayMode === "side-by-side" ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"} label={intl.formatMessage({ id: "views.proposalSideBySide" })} title={intl.formatMessage({ id: "views.proposalSideBySide" })} aria-pressed={displayMode === "side-by-side"} onClick={() => setDisplayMode("side-by-side")}>
                            <SideBySideIcon />
                        </IconButton>
                        <IconButton className={displayMode === "stacked" ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"} label={intl.formatMessage({ id: "views.proposalStacked" })} title={intl.formatMessage({ id: "views.proposalStacked" })} aria-pressed={displayMode === "stacked"} onClick={() => setDisplayMode("stacked")}>
                            <ListIcon />
                        </IconButton>
                        <IconButton className={highlightChanges ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"} label={intl.formatMessage({ id: "views.proposalHighlight" })} title={intl.formatMessage({ id: "views.proposalHighlight" })} aria-pressed={highlightChanges} onClick={() => setHighlightChanges((current) => !current)}>
                            <AlignedParagraphsIcon />
                        </IconButton>
                    </div>}
                    {presentation.changes.length > 1 && <nav className="flex gap-2" aria-label={intl.formatMessage({ id: "views.changeNavigation" })}>
                        <Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "views.previousChange" })} title={intl.formatMessage({ id: "views.previousChange" })} onClick={() => moveChange(-1)}><ChevronRightIcon className="size-4 rotate-180" /></Button>
                        <Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "views.nextChange" })} title={intl.formatMessage({ id: "views.nextChange" })} onClick={() => moveChange(1)}><ChevronRightIcon className="size-4" /></Button>
                    </nav>}
                    <Button variant="secondary" disabled={accepted || stale || presentation.changes.length === 0} onClick={rejectAll}>{intl.formatMessage({ id: "views.rejectAll" })}</Button>
                    <Button variant="secondary" disabled={accepted || stale || presentation.changes.length === 0} onClick={() => void acceptAll()}>{intl.formatMessage({ id: "views.acceptAll" })}</Button>
                    <Button disabled={acceptanceBlocked || !allResolved || counts.accepted === 0} onClick={() => void applyAccepted()}>{intl.formatMessage({ id: "views.applyAccepted" })}</Button>
                </div>
            </div>
        </header>
        {(!presentation.reliable || stale)
            && <div className="mt-4">{!presentation.reliable
                && <Banner className="mb-3" tone="warning">{intl.formatMessage({ id: "views.proposalFallback" })}</Banner>}
            <ProposalDiff original={review.baseContent} proposed={review.proposedContent} layout={displayMode === "side-by-side" ? "columns" : "stacked"} highlight={highlightChanges} />
            </div>}
        {presentation.changes.length === 0
            ? <EmptyState title={intl.formatMessage({ id: "views.proposalNoChanges" })}>
                <Button variant="secondary" onClick={dismissProposal}>{intl.formatMessage({ id: "views.dismissProposal" })}</Button>
            </EmptyState>
            : presentation.reliable && !stale && <div className="mt-4 space-y-4">{presentation.changes.map((change, index) => {
                const decision = decisions[change.id] ?? "pending";
                const decisionClasses = decision === "accepted" ? "border-success bg-success-soft" : decision === "rejected" ? "border-danger bg-danger-soft" : "border-border bg-surface-raised";
                return <article key={change.id} ref={(element) => {
                    cards.current[index] = element;
                }} tabIndex={-1} className={`rounded-panel border p-4 ${decisionClasses}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">{intl.formatMessage({ id: `views.changeType.${change.kind}` as never }, { index: index + 1, total: presentation.changes.length })}</h3>
                            <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: `views.decision.${decision}` as never })}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" state={decision === "rejected" ? "error" : "default"} disabled={accepted || stale} onClick={() => setDecision(change.id, "rejected")}>{intl.formatMessage({ id: "views.rejectChange" })}</Button>
                            <Button state={decision === "accepted" ? "success" : "default"} disabled={accepted || stale} onClick={() => setDecision(change.id, "accepted")}>{intl.formatMessage({ id: "views.acceptChange" })}</Button>
                        </div>
                    </div>
                    <div className="mt-4 flex min-h-9 items-start gap-2 border-y border-border py-3 text-sm" aria-live="polite">
                        <AssistantIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                        <p>{summaries?.[change.id] ?? (summaryState === "loading" ? intl.formatMessage({ id: "views.proposalSummaryLoading" }) : intl.formatMessage({ id: "views.proposalSummaryUnavailable" }))}</p>
                    </div>
                    <div className="mt-4">
                        <ProposalDiff decision={decision} original={change.baseLines.join("\n")} proposed={change.proposalLines.join("\n")} layout={displayMode === "side-by-side" ? "columns" : "stacked"} highlight={highlightChanges} />
                    </div>
                </article>;
            })}</div>
        }
    </div>;
}
