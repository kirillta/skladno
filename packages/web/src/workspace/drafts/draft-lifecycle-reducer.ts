import type { DraftLifecycleEvent, DraftLifecycleState } from "./draft-lifecycle.js";


function hydrateDraft(event: Extract<DraftLifecycleEvent, { type: "hydrate" }>): DraftLifecycleState {
    return {
        phase: event.draftVersion === undefined ? "clean" : "checkpointed",
        content: event.content,
        baseRevisionId: event.baseRevisionId,
        ...(event.draftVersion === undefined ? {} : { draftVersion: event.draftVersion }),
        generation: 0,
    };
}


function editDraft(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "edit" }>): DraftLifecycleState {
    return {
        phase: "dirty",
        content: event.content,
        baseRevisionId: state.baseRevisionId,
        ...(state.draftVersion === undefined ? {} : { draftVersion: state.draftVersion }),
        generation: state.generation + 1,
    };
}


function startCheckpoint(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "checkpoint-started" }>): DraftLifecycleState {
    if (event.generation !== state.generation || state.phase === "conflicted")
        return state;

    return { ...state, phase: "checkpointing", failureOperation: undefined };
}


function finishCheckpoint(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "checkpointed" }>): DraftLifecycleState {
    if (event.generation !== state.generation)
        return { ...state, draftVersion: event.draftVersion };

    return {
        phase: "checkpointed",
        content: state.content,
        baseRevisionId: state.baseRevisionId,
        draftVersion: event.draftVersion,
        generation: state.generation,
    };
}


function discardCheckpoint(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "checkpoint-discarded" }>): DraftLifecycleState {
    if (event.generation !== state.generation) {
        const { draftVersion: _draftVersion, ...next } = state;
        void _draftVersion;
        return next;
    }

    return { phase: "clean", content: state.content, baseRevisionId: state.baseRevisionId, generation: state.generation };
}


function failDraft(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "failed" }>): DraftLifecycleState {
    if (event.generation !== state.generation)
        return state;

    return { ...state, phase: "failed", failureOperation: event.operation, conflict: undefined };
}


function conflictDraft(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "conflicted" }>): DraftLifecycleState {
    return {
        phase: "conflicted",
        content: event.conflict.localContent,
        baseRevisionId: state.baseRevisionId,
        ...(state.draftVersion === undefined ? {} : { draftVersion: state.draftVersion }),
        generation: state.generation,
        conflict: event.conflict,
    };
}


function startPromotion(state: DraftLifecycleState): DraftLifecycleState {
    if (state.draftVersion === undefined || state.phase === "conflicted")
        return state;

    return { ...state, phase: "promoting", failureOperation: undefined };
}


function promoteDraft(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "promoted" }>): DraftLifecycleState {
    return { phase: "clean", content: event.content, baseRevisionId: event.revisionId, generation: state.generation + 1 };
}


function keepLocalDraft(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "keep-local" }>): DraftLifecycleState {
    return {
        phase: "dirty",
        content: state.content,
        baseRevisionId: event.baseRevisionId,
        ...(event.draftVersion === undefined ? {} : { draftVersion: event.draftVersion }),
        generation: state.generation + 1,
    };
}


function restoreRetainedDraft(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "use-retained-draft" }>): DraftLifecycleState {
    return {
        phase: "checkpointed",
        content: event.content,
        baseRevisionId: event.baseRevisionId,
        draftVersion: event.draftVersion,
        generation: state.generation + 1,
    };
}


function restoreCurrentRevision(state: DraftLifecycleState, event: Extract<DraftLifecycleEvent, { type: "use-current-revision" }>): DraftLifecycleState {
    return { phase: "clean", content: event.content, baseRevisionId: event.revisionId, generation: state.generation + 1 };
}


export function reduceDraftLifecycle(state: DraftLifecycleState, event: DraftLifecycleEvent): DraftLifecycleState {
    switch (event.type) {
        case "hydrate":
            return hydrateDraft(event);
        case "edit":
            return editDraft(state, event);
        case "checkpoint-started":
            return startCheckpoint(state, event);
        case "checkpointed":
            return finishCheckpoint(state, event);
        case "checkpoint-discarded":
            return discardCheckpoint(state, event);
        case "failed":
            return failDraft(state, event);
        case "conflicted":
            return conflictDraft(state, event);
        case "promotion-started":
            return startPromotion(state);
        case "promoted":
            return promoteDraft(state, event);
        case "keep-local":
            return keepLocalDraft(state, event);
        case "use-retained-draft":
            return restoreRetainedDraft(state, event);
        case "use-current-revision":
            return restoreCurrentRevision(state, event);
    }
}
