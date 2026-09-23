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
    interfaceLocale?: string;
}


export const createArticleRevisionsPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/revisions`;
export const createArticleDraftPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/draft`;
export const acceptProposalPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/proposal-acceptances`;
export const createProposalSummariesPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/proposal-summaries`;
export const restoreRevisionPath = (articleId: string, revisionId: string) => `${createArticleRevisionsPath(articleId)}/${encodeURIComponent(revisionId)}/restorations`;


function splitLines(content: string): string[] {
    return content === "" ? [] : content.split("\n");
}


function findParagraphEnd(lines: string[], index: number): number {
    while (index < lines.length && lines[index]!.trim() !== "")
        index += 1;

    return index;
}


function findSeparatorEnd(lines: string[], index: number): number {
    while (index < lines.length && lines[index]!.trim() === "")
        index += 1;

    return index;
}


function getParagraphRanges(contentLines: string[]): { start: number; end: number }[] {
    const paragraphs: { start: number; end: number }[] = [];
    let index = 0;

    while (index < contentLines.length) {
        const start = index;
        index = findParagraphEnd(contentLines, index);

        if (start < index)
            paragraphs.push({ start, end: index });

        index = findSeparatorEnd(contentLines, index);
    }

    return paragraphs;
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


function createProposalLcsTable(baseLines: string[], proposalLines: string[]): number[][] {
    const table = Array.from({ length: baseLines.length + 1 }, () => Array<number>(proposalLines.length + 1).fill(0));
    for (let baseIndex = baseLines.length - 1; baseIndex >= 0; baseIndex -= 1) {
        for (let proposalIndex = proposalLines.length - 1; proposalIndex >= 0; proposalIndex -= 1) {
            const linesMatch = baseLines[baseIndex].trim() !== "" && baseLines[baseIndex] === proposalLines[proposalIndex];
            table[baseIndex][proposalIndex] = linesMatch
                ? table[baseIndex + 1][proposalIndex + 1] + 1
                : Math.max(table[baseIndex + 1][proposalIndex], table[baseIndex][proposalIndex + 1]);
        }
    }

    return table;
}


function getCommonProposalEdges(removed: string[], added: string[]): { start: number; removedEnd: number; addedEnd: number } {
    let start = 0;
    while (start < removed.length && start < added.length && removed[start] === added[start])
        start += 1;

    let removedEnd = removed.length;
    let addedEnd = added.length;
    while (removedEnd > start && addedEnd > start && removed[removedEnd - 1] === added[addedEnd - 1]) {
        removedEnd -= 1;
        addedEnd -= 1;
    }

    return { start, removedEnd, addedEnd };
}


function proposalChangeRanges(removed: string[], added: string[]): { base: { start: number; end: number }; proposal: { start: number; end: number } }[] {
    const baseParagraphs = getParagraphRanges(removed);
    const proposalParagraphs = getParagraphRanges(added);
    const sameParagraphStructure = baseParagraphs.length > 1
        && baseParagraphs.length === proposalParagraphs.length;

    if (sameParagraphStructure)
        return baseParagraphs.map((base, index) => ({
            base: { start: base.start, end: baseParagraphs[index + 1]?.start ?? removed.length },
            proposal: { start: proposalParagraphs[index]!.start, end: proposalParagraphs[index + 1]?.start ?? added.length },
        }));

    return [{ base: { start: 0, end: removed.length }, proposal: { start: 0, end: added.length } }];
}


function appendProposalChanges(changes: ProposalChange[], changeBaseStart: number, removed: string[], added: string[]): number {
    const edges = getCommonProposalEdges(removed, added);
    const trimmedRemoved = removed.slice(edges.start, edges.removedEnd);
    const trimmedAdded = added.slice(edges.start, edges.addedEnd);
    if (trimmedRemoved.length === 0 && trimmedAdded.length === 0)
        return changeBaseStart + edges.start;

    for (const range of proposalChangeRanges(trimmedRemoved, trimmedAdded)) {
        changes.push({
            id: `change-${changes.length + 1}`,
            baseStart: changeBaseStart + edges.start + range.base.start,
            baseEnd: changeBaseStart + edges.start + range.base.end,
            baseLines: trimmedRemoved.slice(range.base.start, range.base.end),
            proposalLines: trimmedAdded.slice(range.proposal.start, range.proposal.end),
        });
    }

    return changeBaseStart + edges.start;
}


function isUnchangedLine(baseLines: string[], proposalLines: string[], baseIndex: number, proposalIndex: number): boolean {
    return baseIndex < baseLines.length && proposalIndex < proposalLines.length
        && baseLines[baseIndex].trim() !== "" && baseLines[baseIndex] === proposalLines[proposalIndex];
}


function shouldAddProposalLine(baseLines: string[], proposalLines: string[], table: number[][], baseIndex: number, proposalIndex: number): boolean {
    return proposalIndex < proposalLines.length
        && (baseIndex === baseLines.length || table[baseIndex][proposalIndex + 1] >= table[baseIndex + 1][proposalIndex]);
}


function getProposalChangeStart(current: number, baseIndex: number, removed: string[], added: string[]): number {
    return removed.length === 0 && added.length === 0 ? baseIndex : current;
}


/**
 * Creates line-based hunks. They are deliberately used only while the original
 * revision remains current; callers must otherwise fall back to whole-proposal review.
 */
export function createTextProposal(baseContent: string, proposedContent: string): TextProposal {
    const baseLines = splitLines(baseContent);
    const proposalLines = splitLines(proposedContent);
    const table = createProposalLcsTable(baseLines, proposalLines);
    const changes: ProposalChange[] = [];
    let baseIndex = 0;
    let proposalIndex = 0;
    let changeBaseStart = 0;
    let removed: string[] = [];
    let added: string[] = [];

    while (baseIndex < baseLines.length || proposalIndex < proposalLines.length) {
        if (isUnchangedLine(baseLines, proposalLines, baseIndex, proposalIndex)) {
            changeBaseStart = appendProposalChanges(changes, changeBaseStart, removed, added);
            removed = [];
            added = [];
            baseIndex += 1;
            proposalIndex += 1;
        } else if (shouldAddProposalLine(baseLines, proposalLines, table, baseIndex, proposalIndex)) {
            changeBaseStart = getProposalChangeStart(changeBaseStart, baseIndex, removed, added);
            added.push(proposalLines[proposalIndex]);
            proposalIndex += 1;
        } else {
            changeBaseStart = getProposalChangeStart(changeBaseStart, baseIndex, removed, added);
            removed.push(baseLines[baseIndex]);
            baseIndex += 1;
        }
    }

    appendProposalChanges(changes, changeBaseStart, removed, added);
    return { baseContent, proposedContent, changes };
}


export function applyProposalChanges(proposal: TextProposal, selectedChangeIds: ReadonlySet<string>, preserveBlankLines = false): string {
    const baseLines = splitLines(proposal.baseContent);
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
