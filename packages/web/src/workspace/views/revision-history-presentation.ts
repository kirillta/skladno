import type { ComponentType } from "react";
import { REVISION_PROVENANCE_KIND, type ArticleRevision } from "@skladno/shared";
import { ArticleIcon, RevisionAiIcon, RevisionManualIcon, RevisionRestoreIcon } from "../../ui/icons.js";


export function characterCount(content: string): number {
    return Array.from(content).length;
}


export function provenanceMessageId(revision: ArticleRevision): "revisions.initial" | "revisions.author" | "revisions.acceptedProposal" | "revisions.restored" | "revisions.saved" {
    if (revision.restoredFromRevisionId || revision.provenance.kind === REVISION_PROVENANCE_KIND.RESTORE)
        return "revisions.restored";

    if (revision.provenance.kind === REVISION_PROVENANCE_KIND.INITIAL)
        return "revisions.initial";

    if (revision.provenance.kind === REVISION_PROVENANCE_KIND.AUTHOR_DRAFT)
        return "revisions.author";

    if (revision.provenance.kind === REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL)
        return "revisions.acceptedProposal";

    return "revisions.saved";
}


export type RevisionTimelineKind = "initial" | "manual" | "ai" | "restored";


export function timelineKind(revision: ArticleRevision): RevisionTimelineKind {
    if (revision.restoredFromRevisionId || revision.provenance.kind === REVISION_PROVENANCE_KIND.RESTORE)
        return "restored";

    if (revision.provenance.kind === REVISION_PROVENANCE_KIND.INITIAL)
        return "initial";

    if (revision.provenance.kind === REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL)
        return "ai";

    return "manual";
}


export const timelineIcons: Record<RevisionTimelineKind, ComponentType<{ className?: string }>> = {
    initial: ArticleIcon,
    manual: RevisionManualIcon,
    ai: RevisionAiIcon,
    restored: RevisionRestoreIcon,
};
