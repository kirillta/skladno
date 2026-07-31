import type { TextProposal } from "@skladno/shared";
import { Banner, Button, Diff, EmptyState } from "../../ui/primitives.js";
import { useIntl } from "react-intl";

export function ProposalReviewView({ review, stale, selectedChanges, setSelectedChanges, accept, reject }: {
    review: TextProposal | undefined;
    stale: boolean;
    selectedChanges: Set<string>;
    setSelectedChanges: (update: (current: Set<string>) => Set<string>) => void;
    accept: () => Promise<void>;
    reject: () => void
}) {
    const intl = useIntl();
    if (!review)
        return <EmptyState title={intl.formatMessage({ id: "views.proposalEmptyTitle" })}>{intl.formatMessage({ id: "views.proposalEmpty" })}</EmptyState>;

    return <div>
        <h2 className="font-semibold">{intl.formatMessage({ id: "views.proposalReview" })}</h2>
        {stale && <Banner className="mt-3" tone="warning">{intl.formatMessage({ id: "views.proposalStale" })}</Banner>}
        {review.changes.map((change) => <label key={change.id} className="mt-3 block">
            <input type="checkbox"
                checked={selectedChanges.has(change.id)}
                onChange={() => setSelectedChanges((current) => {
                    const next = new Set(current);

                    if (next.has(change.id))
                        next.delete(change.id);
                    else
                        next.add(change.id);

                    return next;
                })} />
            <span className="ml-2">{intl.formatMessage({ id: "views.selectChange" })}</span>
            <Diff removed={change.baseLines.join("\n")} added={change.proposalLines.join("\n")} />
        </label>)}
        <div className="mt-4 flex gap-2">
            <Button disabled={stale || selectedChanges.size === 0} onClick={() => void accept()}>{intl.formatMessage({ id: "views.acceptSelected" })}</Button>
            <Button variant="secondary" onClick={reject}>{intl.formatMessage({ id: "views.rejectProposal" })}</Button>
        </div>
    </div>;
}
