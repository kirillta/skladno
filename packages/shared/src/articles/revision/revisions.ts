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
    editorialArtifactId: string;
    interfaceLocale: string;
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


function paragraphRanges(contentLines: string[]): { paragraphs: { start: number; end: number }[]; separators: string[][] } {
    const paragraphs: { start: number; end: number }[] = [];
    const separators: string[][] = [];
    let index = 0;

    while (index < contentLines.length) {
        const start = index;
        while (index < contentLines.length && contentLines[index]!.trim() !== "")
            index += 1;

        if (start < index)
            paragraphs.push({ start, end: index });

        const separatorStart = index;
        while (index < contentLines.length && contentLines[index]!.trim() === "")
            index += 1;

        if (index < contentLines.length)
            separators.push(contentLines.slice(separatorStart, index));
    }

    return { paragraphs, separators };
}


function replacementLines(change: ProposalChange, preserveBlankLines: boolean): string[] {
    if (!preserveBlankLines)
        return change.proposalLines;

    const proposedText = change.proposalLines.filter((line) => line.trim() !== "");
    if (proposedText.length !== change.baseLines.filter((line) => line.trim() !== "").length)
        return change.proposalLines;

    let index = 0;
    return change.baseLines.map((line) => line.trim() === "" ? line : proposedText[index++]!);
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
            table[baseIndex][proposalIndex] = baseLines[baseIndex].trim() !== "" && baseLines[baseIndex] === proposalLines[proposalIndex]
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
        // Blank separators cannot anchor alignment, but shared edges need no decision.
        let start = 0;
        while (start < removed.length && start < added.length && removed[start] === added[start])
            start += 1;

        let removedEnd = removed.length;
        let addedEnd = added.length;
        while (removedEnd > start && addedEnd > start && removed[removedEnd - 1] === added[addedEnd - 1]) {
            removedEnd -= 1;
            addedEnd -= 1;
        }

        changeBaseStart += start;
        removed = removed.slice(start, removedEnd);
        added = added.slice(start, addedEnd);

        if (removed.length === 0 && added.length === 0)
            return;

        const baseParagraphs = paragraphRanges(removed);
        const proposalParagraphs = paragraphRanges(added);
        const sameParagraphStructure = baseParagraphs.paragraphs.length > 1
            && baseParagraphs.paragraphs.length === proposalParagraphs.paragraphs.length
            && JSON.stringify(baseParagraphs.separators) === JSON.stringify(proposalParagraphs.separators);
        const ranges = sameParagraphStructure
            ? baseParagraphs.paragraphs.map((base, index) => ({ base, proposal: proposalParagraphs.paragraphs[index]! }))
            : [{ base: { start: 0, end: removed.length }, proposal: { start: 0, end: added.length } }];

        for (const range of ranges) {
            changes.push({
                id: `change-${changes.length + 1}`,
                baseStart: changeBaseStart + range.base.start,
                baseEnd: changeBaseStart + range.base.end,
                baseLines: removed.slice(range.base.start, range.base.end),
                proposalLines: added.slice(range.proposal.start, range.proposal.end),
            });
        }

        removed = [];
        added = [];
    };

    while (baseIndex < baseLines.length || proposalIndex < proposalLines.length) {
        if (baseIndex < baseLines.length && proposalIndex < proposalLines.length && baseLines[baseIndex].trim() !== "" && baseLines[baseIndex] === proposalLines[proposalIndex]) {
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


export function applyProposalChanges(proposal: TextProposal, selectedChangeIds: ReadonlySet<string>, preserveBlankLines = false): string {
    const baseLines = lines(proposal.baseContent);
    const result: string[] = [];
    let cursor = 0;

    for (const change of proposal.changes) {
        result.push(...baseLines.slice(cursor, change.baseStart));
        result.push(...(selectedChangeIds.has(change.id) ? replacementLines(change, preserveBlankLines) : change.baseLines));
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
