import type { ArticleRevision } from "./revision.js";


export interface ProposalChange {
    id: string;
    baseStart: number;
    baseEnd: number;
    baseLines: string[];
    proposalLines: string[];
}


export interface TextProposal {
    baseContent: string;
    proposedContent: string;
    changes: ProposalChange[];
}

export interface ProposalChangeSummary {
    changeId: string;
    summary: string;
}

export interface SummarizeProposalInput {
    changes: ProposalChange[];
}


export interface AcceptProposalInput {
    baseRevisionId: string;
    content: string;
    provenance: Record<string, unknown>;
}


export const articleRevisionsPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/revisions`;
export const articleDraftPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/draft`;
export const acceptProposalPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/proposal-acceptances`;
export const proposalSummariesPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/proposal-summaries`;
export const restoreRevisionPath = (articleId: string, revisionId: string) => `${articleRevisionsPath(articleId)}/${encodeURIComponent(revisionId)}/restorations`;


function lines(content: string): string[] {
    return content === "" ? [] : content.split("\n");
}


/**
 * Creates line-based hunks. They are deliberately used only while the original
 * revision remains current; callers must otherwise fall back to whole-proposal review.
 */
export function createTextProposal(baseContent: string, proposedContent: string): TextProposal {
    const baseLines = lines(baseContent);
    const proposalLines = lines(proposedContent);
    const table = Array.from({ length: baseLines.length + 1 }, () => Array<number>(proposalLines.length + 1).fill(0));

    for (let baseIndex = baseLines.length - 1; baseIndex >= 0; baseIndex -= 1) {
        for (let proposalIndex = proposalLines.length - 1; proposalIndex >= 0; proposalIndex -= 1) {
            table[baseIndex][proposalIndex] = baseLines[baseIndex] === proposalLines[proposalIndex]
                ? table[baseIndex + 1][proposalIndex + 1] + 1
                : Math.max(table[baseIndex + 1][proposalIndex], table[baseIndex][proposalIndex + 1]);
        }
    }

    const changes: ProposalChange[] = [];
    let baseIndex = 0;
    let proposalIndex = 0;
    let changeBaseStart = 0;
    let removed: string[] = [];
    let added: string[] = [];

    const flush = () => {
        if (removed.length === 0 && added.length === 0)
            return;

        changes.push({
            id: `change-${changes.length + 1}`,
            baseStart: changeBaseStart,
            baseEnd: changeBaseStart + removed.length,
            baseLines: removed,
            proposalLines: added,
        });

        removed = [];
        added = [];
    };

    while (baseIndex < baseLines.length || proposalIndex < proposalLines.length) {
        if (baseIndex < baseLines.length && proposalIndex < proposalLines.length && baseLines[baseIndex] === proposalLines[proposalIndex]) {
            flush();
            baseIndex += 1;
            proposalIndex += 1;
        } else if (proposalIndex < proposalLines.length && (baseIndex === baseLines.length || table[baseIndex][proposalIndex + 1] >= table[baseIndex + 1][proposalIndex])) {
            if (removed.length === 0 && added.length === 0)
                changeBaseStart = baseIndex;

            added.push(proposalLines[proposalIndex]);
            proposalIndex += 1;
        } else {
            if (removed.length === 0 && added.length === 0)
                changeBaseStart = baseIndex;

            removed.push(baseLines[baseIndex]);
            baseIndex += 1;
        }
    }

    flush();
    return { baseContent, proposedContent, changes };
}


export function applyProposalChanges(proposal: TextProposal, selectedChangeIds: ReadonlySet<string>): string {
    const baseLines = lines(proposal.baseContent);
    const result: string[] = [];
    let cursor = 0;

    for (const change of proposal.changes) {
        result.push(...baseLines.slice(cursor, change.baseStart));
        result.push(...(selectedChangeIds.has(change.id) ? change.proposalLines : change.baseLines));
        cursor = change.baseEnd;
    }

    result.push(...baseLines.slice(cursor));
    return result.join("\n");
}


export interface RevisionClient {
    listArticleRevisions(articleId: string): Promise<ArticleRevision[]>;
    acceptProposal(articleId: string, input: AcceptProposalInput): Promise<ArticleRevision>;
    restoreRevision(articleId: string, revisionId: string): Promise<ArticleRevision>;
    summarizeProposal(articleId: string, input: SummarizeProposalInput): Promise<ProposalChangeSummary[]>;
}
