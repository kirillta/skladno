import type { ComponentType } from "react";
import { REVISION_PROVENANCE_KIND, type ArticleRevision } from "@skladno/shared";
import { ArticleIcon, RevisionAiIcon, RevisionManualIcon, RevisionRestoreIcon } from "../../ui/icons.js";


export function getCharacterCount(content: string): number {
    return Array.from(content).length;
}


export function getProvenanceMessageId(revision: Pick<ArticleRevision, "provenance" | "restoredFromRevisionId">): "revisions.initial" | "revisions.author" | "revisions.acceptedProposal" | "revisions.restored" | "revisions.saved" {
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


export function getRevisionTitle(revision: ArticleRevision, provenance: string): string {
    return revision.description ?? provenance;
}


export function getRestoredRevisionTarget(revisions: ArticleRevision[], revision: ArticleRevision): { number: number; description?: string } | undefined {
    if (!revision.restoredFromRevisionId)
        return undefined;

    const targetIndex = revisions.findIndex((item) => item.id === revision.restoredFromRevisionId);
    const target = targetIndex < 0 ? undefined : revisions[targetIndex];

    return target
        ? {
            number: targetIndex + 1,
            ...(target.description ? { description: target.description } : {})
        }
        : undefined;
}


export type RevisionTimelineKind = "initial" | "manual" | "ai" | "restored";


export function getTimelineKind(revision: ArticleRevision): RevisionTimelineKind {
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
