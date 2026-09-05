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


function completedMarkdownBlocks(text: string): { blocks: string[]; tail: string } {
    const blocks: string[] = [];
    let current = "";
    let fenced = false;
    let position = 0;

    while (position < text.length) {
        const lineEnd = text.indexOf("\n", position);
        if (lineEnd < 0)
            break;

        const line = text.slice(position, lineEnd + 1);
        const trimmed = line.trim();
        position = lineEnd + 1;

        if (/^```/.test(trimmed)) {
            current += line;
            fenced = !fenced;
            if (!fenced) {
                blocks.push(current);
                current = "";
            }

            continue;
        }

        if (fenced) {
            current += line;

            continue;
        }

        if (!trimmed) {
            if (current.trim())
                blocks.push(current);

            current = "";

            continue;
        }

        if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?)/.test(trimmed)) {
            if (current.trim())
                blocks.push(current);

            blocks.push(line);
            current = "";

            continue;
        }

        current += line;
    }

    return { blocks, tail: `${current}${text.slice(position)}` };
}


function isReviewResponse(responseKind: AssistantResponseKind): boolean {
    return responseKind === "proposal_prepared"
        || responseKind === "findings_prepared"
        || responseKind === "proposal_and_findings_prepared"
        || responseKind === "translation_proposal_prepared";
}


export function updateStreamedMessage({ event, articleId, streamedId, buffers, update }: {
    event: AssistantEvent;
    articleId: string;
    streamedId: string;
    buffers: Record<string, StreamBuffer>;
    update: (message: StreamedAssistantMessage) => void;
}): boolean {
    if (event.type === ASSISTANT_EVENT.TEXT_DELTA) {
        const buffer = buffers[articleId] ?? { blocks: [], tail: "" };
        const next = completedMarkdownBlocks(`${buffer.tail}${event.delta}`);
        const blocks = [...buffer.blocks, ...next.blocks];
        buffers[articleId] = { blocks, tail: next.tail };
        if (!next.blocks.length)
            return true;

        update({ id: streamedId, articleId, blocks, createdAt: new Date().toISOString(), status: "pending" });

        return true;
    }

    const responseKind = event.type === ASSISTANT_EVENT.STAGED_COMPLETION
        ? event.completion.responseKind
        : event.type === ASSISTANT_EVENT.COMPLETED ? event.responseKind : undefined;
    if (!responseKind)
        return false;

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

    return true;
}
