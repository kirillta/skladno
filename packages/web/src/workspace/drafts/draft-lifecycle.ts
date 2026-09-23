import type { Article, ArticleDraft } from "@skladno/shared";
import { reduceDraftLifecycle } from "./draft-lifecycle-reducer.js";


export type DraftPresentationState = "saved" | "unsaved" | "saving" | "draft-saved" | "error" | "conflict";
export type DraftLifecyclePhase = "clean" | "dirty" | "checkpointing" | "checkpointed" | "promoting" | "failed" | "conflicted";
export type DraftFailureOperation = "checkpoint" | "promotion" | "discard";


export interface DraftConflict {
    article: Article;
    draft?: ArticleDraft;
    localContent: string;
}


export interface DraftLifecycleState {
    phase: DraftLifecyclePhase;
    content: string;
    baseRevisionId: string;
    draftVersion?: number;
    generation: number;
    failureOperation?: DraftFailureOperation;
    conflict?: DraftConflict;
}


export type DraftLifecycleEvent =
    | {
        type: "hydrate";
        content: string;
        baseRevisionId: string;
        draftVersion?: number;
    }
    | {
        type: "edit";
        content: string;
    }
    | {
        type: "checkpoint-started";
        generation: number;
    }
    | {
        type: "checkpointed";
        generation: number;
        draftVersion: number;
    }
    | {
        type: "checkpoint-discarded";
        generation: number;
    }
    | {
        type: "failed";
        operation: DraftFailureOperation;
        generation: number;
    }
    | {
        type: "conflicted";
        conflict: DraftConflict;
    }
    | {
        type: "promotion-started";
    }
    | {
        type: "promoted";
        revisionId: string;
        content: string;
    }
    | {
        type: "keep-local";
        baseRevisionId: string;
        draftVersion?: number;
    }
    | {
        type: "use-retained-draft";
        content: string;
        baseRevisionId: string;
        draftVersion: number;
    }
    | {
        type: "use-current-revision";
        content: string;
        revisionId: string;
    };


export function hydrateDraftLifecycle(article: Article): DraftLifecycleState {
    const draft = article.draft;
    const currentDraft = draft?.baseRevisionId === article.currentRevisionId ? draft : undefined;

    return {
        phase: currentDraft ? "checkpointed" : "clean",
        content: currentDraft?.content ?? article.currentRevision.content,
        baseRevisionId: article.currentRevisionId,
        ...(currentDraft ? { draftVersion: currentDraft.version } : {}),
        generation: 0,
    };
}


export function getDraftPresentationState(state: DraftLifecycleState): DraftPresentationState {
    if (state.phase === "clean")
        return "saved";

    if (state.phase === "dirty")
        return "unsaved";

    if (state.phase === "checkpointing" || state.phase === "promoting")
        return "saving";

    if (state.phase === "checkpointed")
        return "draft-saved";

    if (state.phase === "failed")
        return "error";

    return "conflict";
}


export function hasUncommittedDraftChanges(state: DraftLifecycleState, currentRevisionContent: string): boolean {
    return state.content !== currentRevisionContent;
}


export { reduceDraftLifecycle };


export type DraftLifecycleSessions = Record<string, DraftLifecycleState>;


export interface DraftLifecycleSessionEvent {
    articleId: string;
    event: DraftLifecycleEvent;
}


export type DraftLifecycleSessionsAction = DraftLifecycleSessionEvent | {
    type: "replace";
    sessions: DraftLifecycleSessions;
};


export function reduceDraftLifecycleSessions(sessions: DraftLifecycleSessions, action: DraftLifecycleSessionsAction): DraftLifecycleSessions {
    if ("sessions" in action)
        return action.sessions;

    const current = sessions[action.articleId];
    if (!current)
        return sessions;

    const next = reduceDraftLifecycle(current, action.event);
    if (next === current)
        return sessions;

    return {
        ...sessions,
        [action.articleId]: next,
    };
}
