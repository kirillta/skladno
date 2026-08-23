import { applyProposalChanges, type ProposalChange, type TextProposal } from "@skladno/shared";


export type ProposalDecision = "pending" | "accepted" | "rejected";
export type ProposalChangeKind = "addition" | "removal" | "replacement";


export interface ProposalReviewPresentation {
    reliable: boolean;
    warnings: ("url" | "number" | "code" | "claims")[];
    changes: (ProposalChange & { kind: ProposalChangeKind })[];
}


export function presentProposalReview(review: TextProposal): ProposalReviewPresentation {
    const changes = review.changes.map((change) => ({
        ...change,
        kind: change.baseLines.length === 0 ? "addition" : change.proposalLines.length === 0 ? "removal" : "replacement" as ProposalChangeKind,
    }));
    const ordered = changes.every((change, index) => index === 0 || changes[index - 1]!.baseEnd <= change.baseStart);
    const reliable = ordered
        && new Set(changes.map((change) => change.id)).size === changes.length
        && applyProposalChanges(review, new Set(changes.map((change) => change.id))) === review.proposedContent;
    const changed = changes.flatMap((change) => [...change.baseLines, ...change.proposalLines]).join("\n");
    const warnings: ProposalReviewPresentation["warnings"] = [];

    if (/https?:\/\/|\bwww\./i.test(changed))
        warnings.push("url");

    if (/\b\d+(?:[.,]\d+)?\b/.test(changed))
        warnings.push("number");

    if (/`{1,3}/.test(changed))
        warnings.push("code");

    if (changes.length > 0)
        warnings.push("claims");

    return { reliable, warnings, changes };
}
