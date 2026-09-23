import { ASSISTANT_EVENT, type AssistantEvent, type AssistantResponseKind } from "@skladno/shared";


export interface StreamedAssistantMessage {
    id: string;
    articleId: string;
    blocks: readonly string[];
    createdAt: string;
    responseKind?: AssistantResponseKind;
    status: "pending" | "completed";
}


export interface StreamBuffer {
    blocks: string[];
    tail: string;
}


interface MarkdownBlockState {
    blocks: string[];
    current: string;
    fenced: boolean;
}


function flushMarkdownBlock(state: MarkdownBlockState): void {
    if (!state.current.trim())
        return;

    state.blocks.push(state.current);
    state.current = "";
}


function appendFenceLine(state: MarkdownBlockState, line: string): boolean {
    if (!/^```/.test(line.trim()))
        return false;

    state.current += line;
    state.fenced = !state.fenced;
    if (!state.fenced)
        flushMarkdownBlock(state);

    return true;
}


function appendOrdinaryLine(state: MarkdownBlockState, line: string, trimmed: string): void {
    if (!trimmed) {
        flushMarkdownBlock(state);
        return;
    }

    if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?)/.test(trimmed)) {
        flushMarkdownBlock(state);
        state.blocks.push(line);
        return;
    }

    state.current += line;
}


function appendMarkdownLine(state: MarkdownBlockState, line: string): void {
    if (appendFenceLine(state, line))
        return;

    if (state.fenced) {
        state.current += line;
        return;
    }

    appendOrdinaryLine(state, line, line.trim());
}


function completedMarkdownBlocks(text: string): { blocks: string[]; tail: string } {
    const state: MarkdownBlockState = { blocks: [], current: "", fenced: false };
    let position = 0;

    while (position < text.length) {
        const lineEnd = text.indexOf("\n", position);
        if (lineEnd < 0)
            break;

        const line = text.slice(position, lineEnd + 1);
        position = lineEnd + 1;
        appendMarkdownLine(state, line);
    }

    return { blocks: state.blocks, tail: `${state.current}${text.slice(position)}` };
}


function isReviewResponse(responseKind: AssistantResponseKind): boolean {
    return responseKind === "proposal_prepared"
        || responseKind === "findings_prepared"
        || responseKind === "proposal_and_findings_prepared"
        || responseKind === "translation_proposal_prepared";
}


function updateTextDelta(articleId: string, streamedId: string, buffers: Record<string, StreamBuffer>, update: (message: StreamedAssistantMessage) => void, event: Extract<AssistantEvent, { type: "text_delta" }>): boolean {
    const buffer = buffers[articleId] ?? { blocks: [], tail: "" };
    const next = completedMarkdownBlocks(`${buffer.tail}${event.delta}`);
    const blocks = [...buffer.blocks, ...next.blocks];
    buffers[articleId] = { blocks, tail: next.tail };
    if (!next.blocks.length)
        return true;

    update({ id: streamedId, articleId, blocks, createdAt: new Date().toISOString(), status: "pending" });
    return true;
}


function getCompletedResponseKind(event: AssistantEvent): AssistantResponseKind | undefined {
    if (event.type === ASSISTANT_EVENT.STAGED_COMPLETION)
        return event.completion.responseKind;

    return event.type === ASSISTANT_EVENT.COMPLETED ? event.responseKind : undefined;
}


function updateCompletedMessage(articleId: string, streamedId: string, buffers: Record<string, StreamBuffer>, update: (message: StreamedAssistantMessage) => void, event: AssistantEvent, responseKind: AssistantResponseKind): void {
    const buffer = buffers[articleId] ?? { blocks: [], tail: "" };
    const blocks = isReviewResponse(responseKind)
        ? buffer.blocks
        : [...buffer.blocks, ...(buffer.tail.trim() ? [buffer.tail] : [])];
    buffers[articleId] = { blocks, tail: "" };

    update({
        id: streamedId,
        articleId,
        blocks,
        createdAt: new Date().toISOString(),
        responseKind,
        status: event.type === ASSISTANT_EVENT.COMPLETED ? "completed" : "pending"
    });
}


export function updateStreamedMessage({ event, articleId, streamedId, buffers, update }: {
    event: AssistantEvent;
    articleId: string;
    streamedId: string;
    buffers: Record<string, StreamBuffer>;
    update: (message: StreamedAssistantMessage) => void;
}): boolean {
    if (event.type === ASSISTANT_EVENT.TEXT_DELTA)
        return updateTextDelta(articleId, streamedId, buffers, update, event);

    const responseKind = getCompletedResponseKind(event);
    if (!responseKind)
        return false;

    updateCompletedMessage(articleId, streamedId, buffers, update, event, responseKind);
    return true;
}
