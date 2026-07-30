import type { TextProposal } from "@skladno/shared";
import { Button, Diff, EmptyState } from "../../ui/primitives.js";

export function ProposalReviewView({ review, stale, selectedChanges, setSelectedChanges, accept, reject }: {
    review: TextProposal | undefined;
    stale: boolean;
    selectedChanges: Set<string>;
    setSelectedChanges: (update: (current: Set<string>) => Set<string>) => void;
    accept: () => Promise<void>;
    reject: () => void
}) {
    if (!review)
        return <EmptyState title="No proposal to review">Use the Editorial Assistant to generate a proposal. It will never change your article automatically.</EmptyState>;

    return <div>
        <h2 className="font-semibold">Proposal Review</h2>
        {stale && <p className="mt-3 rounded-control bg-warning-soft p-3 text-sm">This proposal is stale because the article has a newer revision. Generate a new proposal before accepting changes.</p>}
        {review.changes.map((change) => <label key={change.id} className="mt-3 block">
            <input type="checkbox"
                checked={selectedChanges.has(change.id)}
                onChange={() => setSelectedChanges((current) => { const next = new Set(current); next.has(change.id) ? next.delete(change.id) : next.add(change.id); return next; })} />
            <span className="ml-2">Select change</span>
            <Diff removed={change.baseLines.join("\n")} added={change.proposalLines.join("\n")} />
        </label>)}
        <div className="mt-4 flex gap-2">
            <Button disabled={stale || selectedChanges.size === 0} onClick={() => void accept()}>Accept selected changes</Button>
            <Button variant="secondary" onClick={reject}>Reject proposal</Button>
        </div>
    </div>;
}
